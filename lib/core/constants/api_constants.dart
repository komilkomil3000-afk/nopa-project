class ApiConstants {
  /// Production domain and server host
  static const String host = 'nopa-app.ir';
  static const String hostIp = host;
  static const int? port = null;
  static const String baseUrl = 'http://$host/api/v1';
  static const String mediaBaseUrl = 'http://$host';

  /// Prepend [mediaBaseUrl] to relative image/media paths (e.g. '/uploads/...').
  /// Leaves absolute URLs (http:// or https://) untouched, but translates localhost/127.0.0.1 references.
  static String resolveImageUrl(String? url) {
    if (url == null || url.trim().isEmpty) {
      return '';
    }
    var trimmed = url.trim();
    if (trimmed.contains('localhost:5000') ||
        trimmed.contains('127.0.0.1:5000') ||
        trimmed.contains('192.168.100.51:5000')) {
      trimmed = trimmed
          .replaceAll('http://localhost:5000', mediaBaseUrl)
          .replaceAll('http://127.0.0.1:5000', mediaBaseUrl)
          .replaceAll('http://192.168.100.51:5000', mediaBaseUrl)
          .replaceAll('localhost:5000', host)
          .replaceAll('127.0.0.1:5000', host);
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '$mediaBaseUrl$trimmed';
    }
    return '$mediaBaseUrl/$trimmed';
  }
}
