import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Color
import android.media.ExifInterface
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.accurate.AccuratePoseDetectorOptions
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import kotlin.math.max

class PostureLandmarkModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    override fun getName(): String = "PostureLandmarkModule"

    @ReactMethod
    fun extractFromUri(uriString: String, promise: Promise) {
        val parsedUri = Uri.parse(uriString)
        val uriScheme = parsedUri.scheme ?: "unknown"

        Log.d(TAG, "$DEBUG_PREFIX [INPUT STAGE] uri=$uriString scheme=$uriScheme")

        var bitmap: Bitmap? = null
        try {
            val contentResolver = context.contentResolver
            val inputStream: InputStream? = contentResolver.openInputStream(parsedUri)
            bitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()

            if (bitmap == null) {
                Log.d(TAG, "$DEBUG_PREFIX [NATIVE PREPROCESSING] bitmap_loaded=no")
                throw IOException("Failed to decode Bitmap from stream")
            }
            Log.d(TAG, "$DEBUG_PREFIX [NATIVE PREPROCESSING] bitmap_loaded=yes initial_width=${bitmap.width} initial_height=${bitmap.height}")

            // Exif resolution
            val exifStream: InputStream? = contentResolver.openInputStream(parsedUri)
            var exifApplied = false
            if (exifStream != null) {
                val exif = ExifInterface(exifStream)
                val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
                val matrix = Matrix()
                when (orientation) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                    ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                    ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
                    ExifInterface.ORIENTATION_FLIP_VERTICAL -> {
                        matrix.postScale(1f, -1f)
                        matrix.postRotate(180f)
                    }
                }
                if (!matrix.isIdentity) {
                    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
                    bitmap.recycle()
                    bitmap = rotated
                    exifApplied = true
                }
                exifStream.close()
            }
            Log.d(TAG, "$DEBUG_PREFIX [NATIVE PREPROCESSING] exif_rotation_applied=${if (exifApplied) "yes" else "no"}")

            // Resize scaling constraints
            val maxWidth = 1024
            val maxHeight = 1024
            if (bitmap!!.width > maxWidth || bitmap!!.height > maxHeight) {
                val ratioBitmap = bitmap!!.width.toFloat() / bitmap!!.height.toFloat()
                var finalWidth = maxWidth
                var finalHeight = maxHeight
                if (ratioBitmap > 1) {
                    finalHeight = (maxWidth / ratioBitmap).toInt()
                } else {
                    finalWidth = (maxHeight * ratioBitmap).toInt()
                }
                val scaled = Bitmap.createScaledBitmap(bitmap!!, finalWidth, finalHeight, true)
                bitmap!!.recycle()
                bitmap = scaled
            }
            Log.d(TAG, "$DEBUG_PREFIX [NATIVE PREPROCESSING] final_resized_width=${bitmap!!.width} final_resized_height=${bitmap!!.height}")

            // Color Normalization (Contrast + Brightness)
            val normalizedBitmap = Bitmap.createBitmap(bitmap!!.width, bitmap!!.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(normalizedBitmap)
            val paint = Paint()
            val cm = ColorMatrix()
            val contrast = 1.2f
            val brightness = 20f
            cm.set(floatArrayOf(
                contrast, 0f, 0f, 0f, brightness,
                0f, contrast, 0f, 0f, brightness,
                0f, 0f, contrast, 0f, brightness,
                0f, 0f, 0f, 1f, 0f
            ))
            paint.colorFilter = ColorMatrixColorFilter(cm)
            canvas.drawBitmap(bitmap!!, 0f, 0f, paint)
            bitmap!!.recycle()
            bitmap = normalizedBitmap
            
            Log.d(TAG, "$DEBUG_PREFIX [NATIVE PREPROCESSING] lighting_normalization_applied=yes")

        } catch (error: Exception) {
            Log.e(TAG, "$DEBUG_PREFIX HARD_FAIL_REASON: [NATIVE_DECODE] $uriString", error)
            promise.reject("image_load_failed", error.message, error)
            return
        }

        val inputImage = InputImage.fromBitmap(bitmap!!, 0)
        
        val options = AccuratePoseDetectorOptions.Builder()
            .setDetectorMode(AccuratePoseDetectorOptions.SINGLE_IMAGE_MODE)
            .build()
        val detector = PoseDetection.getClient(options)

        detector
            .process(inputImage)
            .addOnSuccessListener { pose ->
                val validLandmarks = pose.allPoseLandmarks.filter { it.inFrameLikelihood > 0.2f }
                val landmarkCount = validLandmarks.size
                val averageConfidence = if (landmarkCount > 0) {
                    validLandmarks.map { it.inFrameLikelihood.toDouble() }.average()
                } else {
                    0.0
                }

                var debugUriString = ""
                if (landmarkCount > 0) {
                    val canvas = Canvas(bitmap!!)
                    val debugPaint = Paint().apply {
                        color = Color.parseColor("#00FF00")
                        strokeWidth = 4f
                        style = Paint.Style.STROKE
                    }
                    val dotPaint = Paint().apply {
                        color = Color.parseColor("#FF0000")
                        style = Paint.Style.FILL
                    }
                    for (lm in validLandmarks) {
                        canvas.drawCircle(lm.position.x, lm.position.y, 6f, dotPaint)
                    }
                    try {
                        val file = File(context.cacheDir, "debug_pose_${System.currentTimeMillis()}.jpg")
                        val out = FileOutputStream(file)
                        bitmap!!.compress(Bitmap.CompressFormat.JPEG, 90, out)
                        out.flush()
                        out.close()
                        debugUriString = "file://${file.absolutePath}"
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed creating debug skeleton image", e)
                    }
                }

                Log.d(TAG, "$DEBUG_PREFIX [ML KIT OUTPUT] raw_landmark_count=$landmarkCount average_confidence=$averageConfidence status=${if (landmarkCount > 0) "ready" else "no_landmarks"} debug_image_uri=${if (debugUriString.isNotEmpty()) "yes" else "no"}")
                
                val resultMap = buildPoseMap(pose, bitmap!!.width, bitmap!!.height, averageConfidence)
                resultMap.putString("debugImageUri", debugUriString)
                
                promise.resolve(resultMap)
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "$DEBUG_PREFIX HARD_FAIL_REASON: [MLKIT_ENGINE] pose_detection_failed uri=$uriString", error)
                val emptyResult = Arguments.createMap()
                emptyResult.putString("status", "no_landmarks")
                emptyResult.putInt("landmarkCount", 0)
                promise.resolve(emptyResult)
            }
            .addOnCompleteListener {
                detector.close()
                bitmap?.recycle()
            }
    }

    private fun buildPoseMap(
        pose: Pose,
        width: Int,
        height: Int,
        averageConfidence: Double
    ): WritableMap {
        val result = Arguments.createMap()
        val sourceSize = Arguments.createMap()
        sourceSize.putInt("width", width)
        sourceSize.putInt("height", height)

        val landmarksMap = Arguments.createMap()
        var validCount = 0
        LANDMARK_TYPES.forEach { entry ->
            val landmark = pose.getPoseLandmark(entry.type) ?: return@forEach
            landmarksMap.putMap(entry.name, buildLandmarkMap(landmark, width, height))
            if (landmark.inFrameLikelihood > 0.2f) {
                validCount++
            }
        }

        result.putMap("sourceSize", sourceSize)
        result.putMap("landmarks", landmarksMap)
        result.putInt("landmarkCount", validCount)
        result.putDouble("averageConfidence", averageConfidence)
        result.putString("provider", "mlkit_native_hardened")
        result.putString("status", if (validCount >= 4) "ready" else if (validCount > 0) "partial_analysis" else "no_landmarks")
        return result
    }

    private fun buildLandmarkMap(
        landmark: PoseLandmark,
        width: Int,
        height: Int
    ): WritableMap {
        val position = landmark.position
        val position3D = landmark.position3D
        val landmarkMap = Arguments.createMap()
        val safeWidth = max(width, 1).toDouble()
        val safeHeight = max(height, 1).toDouble()
        landmarkMap.putDouble("x", position.x.toDouble() / safeWidth)
        landmarkMap.putDouble("y", position.y.toDouble() / safeHeight)
        landmarkMap.putDouble("z", position3D.z.toDouble())
        landmarkMap.putDouble("confidence", landmark.inFrameLikelihood.toDouble())
        return landmarkMap
    }

    private data class LandmarkEntry(val name: String, val type: Int)

    companion object {
        private const val TAG = "PostureLandmarkModule"
        private const val DEBUG_PREFIX = "[POSTURE_RUNTIME_TRACE]"
        private val LANDMARK_TYPES = listOf(
            LandmarkEntry("nose", PoseLandmark.NOSE),
            LandmarkEntry("leftEyeInner", PoseLandmark.LEFT_EYE_INNER),
            LandmarkEntry("leftEye", PoseLandmark.LEFT_EYE),
            LandmarkEntry("leftEyeOuter", PoseLandmark.LEFT_EYE_OUTER),
            LandmarkEntry("rightEyeInner", PoseLandmark.RIGHT_EYE_INNER),
            LandmarkEntry("rightEye", PoseLandmark.RIGHT_EYE),
            LandmarkEntry("rightEyeOuter", PoseLandmark.RIGHT_EYE_OUTER),
            LandmarkEntry("leftEar", PoseLandmark.LEFT_EAR),
            LandmarkEntry("rightEar", PoseLandmark.RIGHT_EAR),
            LandmarkEntry("leftMouth", PoseLandmark.LEFT_MOUTH),
            LandmarkEntry("rightMouth", PoseLandmark.RIGHT_MOUTH),
            LandmarkEntry("leftShoulder", PoseLandmark.LEFT_SHOULDER),
            LandmarkEntry("rightShoulder", PoseLandmark.RIGHT_SHOULDER),
            LandmarkEntry("leftElbow", PoseLandmark.LEFT_ELBOW),
            LandmarkEntry("rightElbow", PoseLandmark.RIGHT_ELBOW),
            LandmarkEntry("leftWrist", PoseLandmark.LEFT_WRIST),
            LandmarkEntry("rightWrist", PoseLandmark.RIGHT_WRIST),
            LandmarkEntry("leftPinky", PoseLandmark.LEFT_PINKY),
            LandmarkEntry("rightPinky", PoseLandmark.RIGHT_PINKY),
            LandmarkEntry("leftIndex", PoseLandmark.LEFT_INDEX),
            LandmarkEntry("rightIndex", PoseLandmark.RIGHT_INDEX),
            LandmarkEntry("leftThumb", PoseLandmark.LEFT_THUMB),
            LandmarkEntry("rightThumb", PoseLandmark.RIGHT_THUMB),
            LandmarkEntry("leftHip", PoseLandmark.LEFT_HIP),
            LandmarkEntry("rightHip", PoseLandmark.RIGHT_HIP),
            LandmarkEntry("leftKnee", PoseLandmark.LEFT_KNEE),
            LandmarkEntry("rightKnee", PoseLandmark.RIGHT_KNEE),
            LandmarkEntry("leftAnkle", PoseLandmark.LEFT_ANKLE),
            LandmarkEntry("rightAnkle", PoseLandmark.RIGHT_ANKLE),
            LandmarkEntry("leftHeel", PoseLandmark.LEFT_HEEL),
            LandmarkEntry("rightHeel", PoseLandmark.RIGHT_HEEL),
            LandmarkEntry("leftFootIndex", PoseLandmark.LEFT_FOOT_INDEX),
            LandmarkEntry("rightFootIndex", PoseLandmark.RIGHT_FOOT_INDEX)
        )
    }
}
