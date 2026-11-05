package com.example.nopa_app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.android.RenderMode
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    override fun getRenderMode(): RenderMode {
        return RenderMode.texture
    }

    // In-app update: the APK downloaded by lib/services/app_update_service.dart is handed to Android's
    // installer through a FileProvider (res/xml/update_paths.xml); no plugin needed.
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "nopa/installer").setMethodCallHandler { call, result ->
            when (call.method) {
                // Android 8+ asks once per app for "install unknown apps"
                "canInstall" -> result.success(
                    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()
                )
                "openInstallSettings" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startActivity(
                            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        )
                    }
                    result.success(true)
                }
                "install" -> {
                    val path = call.argument<String>("path")
                    val file = if (path == null) null else File(path)
                    if (file == null || !file.exists()) {
                        result.error("missing", "file not found", null)
                        return@setMethodCallHandler
                    }
                    try {
                        val uri = FileProvider.getUriForFile(this, "$packageName.updates", file)
                        startActivity(
                            Intent(Intent.ACTION_VIEW)
                                .setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                        )
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("install", e.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
