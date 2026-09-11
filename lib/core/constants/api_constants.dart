class ApiConstants {
  static const String mediaBaseUrl = 'http://192.168.100.51:5000';

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
