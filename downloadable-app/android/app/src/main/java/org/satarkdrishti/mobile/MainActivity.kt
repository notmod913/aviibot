package org.satarkdrishti.mobile

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.net.URI

class MainActivity : Activity() {
    private lateinit var container: LinearLayout
    private lateinit var addressInput: EditText
    private lateinit var statusText: TextView
    private var webView: WebView? = null
    private var permissionRequest: PermissionRequest? = null
    private var geolocationCallback: GeolocationPermissions.Callback? = null
    private var geolocationOrigin: String? = null
    private var serverOrigin: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showConnectScreen()
    }

    private fun showConnectScreen(message: String? = null) {
        webView?.let { container.removeView(it) }
        webView = null

        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 24)
            setBackgroundColor(0xFFF7F8F6.toInt())
        }
        val title = TextView(this).apply {
            text = "Satark Drishti"
            textSize = 26f
            setTextColor(0xFF173C34.toInt())
        }
        val description = TextView(this).apply {
            text = "Connect to the laptop running Satark Drishti on the same Wi-Fi network."
            textSize = 16f
            setPadding(0, 12, 0, 20)
        }
        addressInput = EditText(this).apply {
            hint = "http://192.168.1.10:5173"
            singleLine = true
            setText(getPreferences(MODE_PRIVATE).getString("server_url", ""))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        statusText = TextView(this).apply {
            text = message.orEmpty()
            setTextColor(0xFF9B2C2C.toInt())
            setPadding(0, 8, 0, 12)
        }
        val connectButton = Button(this).apply {
            text = "Connect"
            setOnClickListener { connectToServer(addressInput.text.toString()) }
        }
        container.addView(title)
        container.addView(description)
        container.addView(addressInput, matchWidth())
        container.addView(statusText)
        container.addView(connectButton, matchWidth())
        setContentView(container)
    }

    private fun connectToServer(value: String) {
        val uri = try {
            URI(value.trim())
        } catch (_: Exception) {
            null
        }
        if (uri == null || uri.scheme !in setOf("http", "https") ||
            uri.host.isNullOrBlank() || uri.userInfo != null ||
            uri.host in setOf("localhost", "127.0.0.1", "0.0.0.0")
        ) {
            statusText.text = "Enter the laptop's Wi-Fi URL, for example http://192.168.1.10:5173."
            return
        }

        val normalized = uri.toString().trimEnd('/')
        serverOrigin = "${uri.scheme}://${uri.rawAuthority}"
        getPreferences(MODE_PRIVATE).edit().putString("server_url", normalized).apply()
        showWebView(normalized)
    }

    private fun showWebView(url: String) {
        val view = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.geolocationEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val next = request.url
                    return next.scheme !in setOf("http", "https") ||
                        next.host != URI(serverOrigin).host
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        if (request.origin.toString().startsWith("$serverOrigin/") ||
                            request.origin.toString() == serverOrigin
                        ) {
                            permissionRequest = request
                            if (ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.CAMERA,
                                ) == PackageManager.PERMISSION_GRANTED
                            ) {
                                grantVideoPermission(request)
                            } else {
                                ActivityCompat.requestPermissions(
                                    this@MainActivity,
                                    arrayOf(Manifest.permission.CAMERA),
                                    REQUEST_CAMERA,
                                )
                            }
                        } else {
                            request.deny()
                        }
                    }
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String,
                    callback: GeolocationPermissions.Callback,
                ) {
                    val allowedOrigin = serverOrigin
                    if (allowedOrigin == null || origin != allowedOrigin) {
                        callback.invoke(origin, false, false)
                        return
                    }
                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.ACCESS_FINE_LOCATION,
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        callback.invoke(origin, true, false)
                    } else {
                        geolocationOrigin = origin
                        geolocationCallback = callback
                        ActivityCompat.requestPermissions(
                            this@MainActivity,
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION,
                            ),
                            REQUEST_LOCATION,
                        )
                    }
                }
            }
            loadUrl(url)
        }

        this.webView?.destroy()
        this.webView = view
        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val toolbar = Button(this@MainActivity).apply {
                text = "Change laptop"
                setOnClickListener { showConnectScreen() }
            }
            addView(toolbar, matchWidth())
            addView(
                view,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    0,
                    1f,
                ),
            )
        }
        setContentView(container)
    }

    private fun grantVideoPermission(request: PermissionRequest) {
        val videoOnly = request.resources.filter {
            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
        }.toTypedArray()
        if (videoOnly.isEmpty()) request.deny() else request.grant(videoOnly)
        permissionRequest = null
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            REQUEST_CAMERA -> {
                val request = permissionRequest
                if (request != null && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                    grantVideoPermission(request)
                } else {
                    request?.deny()
                    permissionRequest = null
                }
            }

            REQUEST_LOCATION -> {
                val granted = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
                geolocationCallback?.invoke(geolocationOrigin, granted, false)
                geolocationCallback = null
                geolocationOrigin = null
            }
        }
    }

    override fun onBackPressed() {
        val currentWebView = webView
        if (currentWebView?.canGoBack() == true) {
            currentWebView.goBack()
        } else if (currentWebView != null) {
            showConnectScreen()
        } else {
            super.onBackPressed()
        }
    }

    private fun matchWidth() =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

    override fun onDestroy() {
        webView?.apply {
            stopLoading()
            destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_CAMERA = 110
        private const val REQUEST_LOCATION = 111
    }
}
