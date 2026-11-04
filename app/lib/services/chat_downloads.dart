import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Which chat photos and voices the user has chosen to download. Nothing received is fetched
/// on its own: a message shows a download button until the user taps it, and this is remembered.
class ChatDownloads extends ChangeNotifier {
  ChatDownloads._();
  static final ChatDownloads instance = ChatDownloads._();

  static const _prefsKey = 'chat_downloaded_attachments';
  final Set<String> _ids = {};
  final Set<String> _busy = {};
  bool _loaded = false;

  bool has(String id) => _ids.contains(id);
  bool isBusy(String id) => _busy.contains(id);

  Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      _ids.addAll(prefs.getStringList(_prefsKey) ?? const []);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_prefsKey, _ids.toList());
    } catch (_) {}
  }

  /// Downloads the file into the cache (under [cacheKey]); true when it succeeded.
  Future<bool> download(String id, String url, {String? cacheKey}) async {
    if (_busy.contains(id)) return false;
    _busy.add(id);
    notifyListeners();
    try {
      await CachedNetworkImageProvider.defaultCacheManager.getSingleFile(url, key: cacheKey ?? url);
      _ids.add(id);
      await _save();
      return true;
    } catch (_) {
      return false;
    } finally {
      _busy.remove(id);
      notifyListeners();
    }
  }
}
