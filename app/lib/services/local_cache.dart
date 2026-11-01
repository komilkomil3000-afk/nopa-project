import 'dart:async';
import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Small persistent store for things that must survive going offline or closing the app:
///  * [saveJson]/[loadJson]  – last good server snapshots (profile, challenges, notifications ...)
///  * [saveDraft]/[loadDraft] – text the user was typing but has not sent yet
///
/// Everything is namespaced by the signed-in user id ([scope]) so one account never sees another's data.
class LocalCache {
  LocalCache._();
  static final LocalCache instance = LocalCache._();

  String _scope = 'anon';
  String get scope => _scope;

  /// Set by the repository when the user changes (login / logout); remembered for the next app start so the
  /// last signed-in user's snapshots can be shown before (or without) a connection.
  set scope(String value) {
    if (value == _scope) return;
    _scope = value;
    SharedPreferences.getInstance().then((p) => p.setString('cache.last_scope', value)).catchError((_) => false);
  }

  /// Call once at startup (before runApp).
  Future<void> init() async {
    try {
      final p = await SharedPreferences.getInstance();
      _scope = p.getString('cache.last_scope') ?? 'anon';
    } catch (_) {}
  }

  String _k(String kind, String key) => 'cache.$kind.$scope.$key';

  // ---- server snapshots -------------------------------------------------
  Future<void> saveJson(String key, Object? value) async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_k('json', key), jsonEncode(value));
    } catch (e) {
      debugPrint('[LocalCache] saveJson($key) failed: $e');
    }
  }

  Future<dynamic> loadJson(String key) async {
    try {
      final p = await SharedPreferences.getInstance();
      final raw = p.getString(_k('json', key));
      return raw == null ? null : jsonDecode(raw);
    } catch (e) {
      debugPrint('[LocalCache] loadJson($key) failed: $e');
      return null;
    }
  }

  // ---- drafts -----------------------------------------------------------
  Future<void> saveDraft(String key, String text) async {
    try {
      final p = await SharedPreferences.getInstance();
      if (text.isEmpty) {
        await p.remove(_k('draft', key));
      } else {
        await p.setString(_k('draft', key), text);
      }
    } catch (e) {
      debugPrint('[LocalCache] saveDraft($key) failed: $e');
    }
  }

  Future<String?> loadDraft(String key) async {
    try {
      final p = await SharedPreferences.getInstance();
      return p.getString(_k('draft', key));
    } catch (_) {
      return null;
    }
  }

  Future<void> clearDraft(String key) => saveDraft(key, '');

  /// Removes everything of the current scope (used on logout).
  Future<void> clearScope() async {
    try {
      final p = await SharedPreferences.getInstance();
      final suffix = '.$scope.';
      for (final k in p.getKeys().where((k) => k.startsWith('cache.') && k.contains(suffix)).toList()) {
        await p.remove(k);
      }
    } catch (_) {}
  }
}

/// A [TextEditingController] that keeps its text as a draft: it restores the text when created and saves it
/// (debounced) on every change, so leaving the screen / losing the connection / killing the app loses nothing.
/// Call [clearDraft] after the text was sent successfully.
///
/// Use a stable, specific [draftKey], e.g. `challenge_answer.<challengeId>` or `support_ticket`.
class DraftTextController extends TextEditingController {
  DraftTextController({required this.draftKey, super.text}) {
    _restore();
    addListener(_onChanged);
  }

  final String draftKey;
  Timer? _debounce;
  bool _restoring = true;
  bool _disposed = false;

  Future<void> _restore() async {
    final saved = await LocalCache.instance.loadDraft(draftKey);
    if (!_disposed && saved != null && saved.isNotEmpty && text.isEmpty) {
      value = TextEditingValue(text: saved, selection: TextSelection.collapsed(offset: saved.length));
    }
    _restoring = false;
  }

  void _onChanged() {
    if (_restoring) return;
    _debounce?.cancel();
    final snapshot = text;
    _debounce = Timer(const Duration(milliseconds: 400), () => LocalCache.instance.saveDraft(draftKey, snapshot));
  }

  /// Forget the draft (after a successful send).
  Future<void> clearDraft() async {
    _debounce?.cancel();
    await LocalCache.instance.clearDraft(draftKey);
  }

  @override
  void dispose() {
    _disposed = true;
    // Flush a pending save so the very last keystrokes are not lost when the screen closes.
    if (_debounce?.isActive ?? false) {
      _debounce!.cancel();
      LocalCache.instance.saveDraft(draftKey, text);
    }
    removeListener(_onChanged);
    super.dispose();
  }
}
