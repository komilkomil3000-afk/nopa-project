class ApiConstants {
  /// Machine local LAN IP. Update this IP if your WiFi network / IP changes.
  static const String hostIp = '192.168.100.51';
  static const int port = 5000;
  static const String baseUrl = 'http://$hostIp:$port/api/v1';
  static const String mediaBaseUrl = 'http://$hostIp:$port';

  /// Prepend [mediaBaseUrl] to relative image/media paths (e.g. '/uploads/...').
  /// Leaves absolute URLs (http:// or https://) untouched.
  static String resolveImageUrl(String? url) {
    if (url == null || url.trim().isEmpty) {
      return '';
    }
    final trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '$mediaBaseUrl$trimmed';
    }
    return '$mediaBaseUrl/$trimmed';
  }
}
