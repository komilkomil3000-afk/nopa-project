import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class AparatVideoInfo {
  final String title;
  final String? posterUrl;
  final Map<String, String> qualities; // e.g. {'720p': 'url', '480p': 'url', ...}
  final String defaultUrl;

  AparatVideoInfo({
    required this.title,
    this.posterUrl,
    required this.qualities,
    required this.defaultUrl,
  });
}

class AparatService {
  static final Map<String, AparatVideoInfo> _cache = {};

  /// Extract video hash from various Aparat URL patterns:
  /// - https://www.aparat.com/v/dbjk750
  /// - https://aparat.com/v/dbjk750?data=...
  /// - aparat.com/v/dbjk750
  /// - dbjk750
  static String? extractHash(String urlOrHash) {
    final clean = urlOrHash.trim();
    if (clean.isEmpty) return null;

    final regExp = RegExp(r'(?:aparat\.com\/v\/|aparat\.com\/embed\/|v\/|^)([a-zA-Z0-9_-]{5,15})');
    final match = regExp.firstMatch(clean);
    if (match != null && match.groupCount >= 1) {
      return match.group(1);
    }
    if (!clean.contains('/') && !clean.contains('.')) {
      return clean;
    }
    return null;
  }

  /// Resolve direct MP4 streaming URLs from Aparat API
  static Future<AparatVideoInfo?> resolveAparatVideo(String urlOrHash) async {
    final hash = extractHash(urlOrHash);
    if (hash == null) return null;

    if (_cache.containsKey(hash)) {
      return _cache[hash];
    }

    try {
      final apiUrl = Uri.parse('https://www.aparat.com/api/fa/v1/video/video/show/videohash/$hash');
      final response = await http.get(apiUrl, headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        final attributes = data['data']?['attributes'] ?? {};
        final title = attributes['title']?.toString() ?? 'انیمیشن';
        final posterUrl = attributes['big_poster']?.toString() ?? attributes['poster']?.toString();
        final fileLinks = attributes['file_link_all'] as List? ?? [];

        final Map<String, String> qualities = {};
        for (final item in fileLinks) {
          final profile = item['profile']?.toString() ?? item['text']?.toString() ?? 'کیفیت';
          final urls = item['urls'] as List? ?? [];
          if (urls.isNotEmpty && urls.first.toString().isNotEmpty) {
            qualities[profile] = urls.first.toString();
          }
        }

        String defaultUrl = '';
        // Prefer 720p -> 480p -> 360p -> first available
        if (qualities.containsKey('720p')) {
          defaultUrl = qualities['720p']!;
        } else if (qualities.containsKey('480p')) {
          defaultUrl = qualities['480p']!;
        } else if (qualities.containsKey('360p')) {
          defaultUrl = qualities['360p']!;
        } else if (qualities.isNotEmpty) {
          defaultUrl = qualities.values.first;
        }

        if (defaultUrl.isNotEmpty) {
          final info = AparatVideoInfo(
            title: title,
            posterUrl: posterUrl,
            qualities: qualities,
            defaultUrl: defaultUrl,
          );
          _cache[hash] = info;
          return info;
        }
      }
    } catch (e) {
      debugPrint('Aparat resolution error for $hash: $e');
    }

    return null;
  }
}
