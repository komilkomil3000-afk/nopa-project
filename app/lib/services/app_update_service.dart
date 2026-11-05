import 'dart:convert';
import 'dart:io' show Platform;

import 'package:http/http.dart' as http;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// The newest release the server announces, if it is newer than the installed app.
class AppUpdateInfo {
  final String version;
  /// The file for this phone's processor (see [AppUpdateService.deviceAbi]); empty when the release has none for it.
  final String downloadUrl;
  /// The architecture [downloadUrl] was built for ('universal' for the all-in-one file).
  final String abi;
  final List<String> notes;
  const AppUpdateInfo({required this.version, required this.downloadUrl, required this.abi, required this.notes});
}

class AppUpdateService {
  /// Returns the update when a newer version exists, `null` when the app is current.
  /// Throws when the server cannot be reached.
  static Future<AppUpdateInfo?> check() async {
    final res = await http.get(Uri.parse('${ApiConstants.baseUrl}/app/version')).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final latest = (data['version'] ?? '').toString().trim();
    if (latest.isEmpty) return null;
    final current = (await PackageInfo.fromPlatform()).version;
    if (_compare(latest, current) <= 0) return null;
    final pick = pickDownload(
      deviceAbi(),
      Map<String, dynamic>.from((data['downloads'] as Map?) ?? const {}),
      universal: (data['universalUrl'] ?? '').toString(),
      // a server from before the per-architecture release only sends this one link
      legacy: data.containsKey('downloads') ? '' : (data['downloadUrl'] ?? '').toString(),
    );
    return AppUpdateInfo(
      version: latest,
      downloadUrl: pick.url,
      abi: pick.abi,
      notes: ((data['notes'] as List?) ?? const []).map((e) => e.toString()).toList(),
    );
  }

  /// The processor architecture this app runs on, named like the APK files
  /// (flutter build apk --split-per-abi): arm64-v8a, armeabi-v7a or x86_64.
  /// Read from the Dart VM ("... on "android_arm64""), so no extra plugin is needed.
  static String deviceAbi() {
    final v = Platform.version;
    if (v.contains('android_arm64')) return 'arm64-v8a';
    if (v.contains('android_arm')) return 'armeabi-v7a';
    if (v.contains('android_x64')) return 'x86_64';
    return 'arm64-v8a';
  }

  /// The file this phone should download, in order: its own architecture, the all-in-one file, then the
  /// files the processor can still run (a 64-bit ARM phone can usually run the 32-bit file).
  /// Never a file the phone cannot install (arm64 on a 32-bit phone).
  static ({String url, String abi}) pickDownload(String abi, Map<String, dynamic> downloads, {String universal = '', String legacy = ''}) {
    String of(String a) => (downloads[a] ?? '').toString().trim();
    final order = <String>[
      abi,
      'universal',
      if (abi == 'arm64-v8a') 'armeabi-v7a',
    ];
    for (final a in order) {
      final url = a == 'universal' ? universal.trim() : of(a);
      if (url.isNotEmpty) return (url: url, abi: a);
    }
    if (legacy.trim().isNotEmpty) return (url: legacy.trim(), abi: 'universal');
    return (url: '', abi: abi);
  }

  /// Compares dotted versions numerically ("1.10.0" > "1.9.2"); a "+build" suffix is ignored.
  static int _compare(String a, String b) {
    List<int> parts(String v) => v.split('+').first.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final x = parts(a), y = parts(b);
    for (var i = 0; i < (x.length > y.length ? x.length : y.length); i++) {
      final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
      if (d != 0) return d;
    }
    return 0;
  }
}
