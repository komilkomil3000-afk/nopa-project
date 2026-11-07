package com.example.nopa_app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.android.RenderMode
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private var channel: MethodChannel? = null

    override fun getRenderMode(): RenderMode {
        return RenderMode.texture
    }

    // Answers of Android's package installer for the session started in commitSession
    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                // The one confirmation screen of Android ("Do you want to update this app?")
                @Suppress("DEPRECATION")
                val confirm = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                              else intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirm != null) {
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(confirm)
                }
                return
            }
            // On success Android replaces the app and closes it; this matters only when it did not
            channel?.invokeMethod(
                "status",
                mapOf("status" to status, "message" to (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""))
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ContextCompat.registerReceiver(this, statusReceiver, IntentFilter(INSTALL_ACTION), ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    override fun onDestroy() {
        try { unregisterReceiver(statusReceiver) } catch (_: Exception) {}
        super.onDestroy()
    }

    /** Writes the APK into an install session and commits it: Android asks once, installs, and closes the app. */
    private fun commitSession(file: File) {
        val installer = packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setSize(file.length())
        val id = installer.createSession(params)
        installer.openSession(id).use { session ->
            file.inputStream().use { input ->
                session.openWrite("nopa.apk", 0, file.length()).use { out ->
                    input.copyTo(out)
                    session.fsync(out)
                }
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            val pending = PendingIntent.getBroadcast(this, id, Intent(INSTALL_ACTION).setPackage(packageName), flags)
            session.commit(pending.intentSender)
        }
    }

    /** The plain way: the system's package screen opens the file. */
    private fun viewInstall(file: File) {
        val uri = FileProvider.getUriForFile(this, "$packageName.updates", file)
        startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    // In-app update: the APK downloaded by lib/services/app_update_service.dart is installed through
    // Android's PackageInstaller session (progress and failure reasons come back on "status"); if a session
    // cannot be made, the FileProvider route (res/xml/update_paths.xml) opens the installer screen instead.
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val ch = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "nopa/installer")
        channel = ch
        ch.setMethodCallHandler { call, result ->
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
                        commitSession(file)
                        result.success(true)
                    } catch (e: Exception) {
                        try {
                            viewInstall(file)
                            result.success(true)
                        } catch (e2: Exception) {
                            result.error("install", e2.message ?: e.message, null)
                        }
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    companion object {
        const val INSTALL_ACTION = "com.example.nopa_app.INSTALL_STATUS"
    }
}
