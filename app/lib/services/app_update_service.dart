import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// The newest release the server announces, if it is newer than the installed app.
class AppUpdateInfo {
  final String version;
  final String downloadUrl;
  final List<String> notes;
  const AppUpdateInfo({required this.version, required this.downloadUrl, required this.notes});
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
    return AppUpdateInfo(
      version: latest,
      downloadUrl: (data['downloadUrl'] ?? '').toString(),
      notes: ((data['notes'] as List?) ?? const []).map((e) => e.toString()).toList(),
    );
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
