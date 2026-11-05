import 'dart:async';

import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/core/theme/app_theme.dart';

/// Single entry point for every feedback message in the app.
///
/// Only one message is ever on screen: a new one replaces the current one
/// immediately, and repeating the same text while it is still visible is
/// ignored, so tapping a button many times can't queue up messages.
class AppToast {
  AppToast._();

  static const Color textColor = Color(0xFFE4E4FF);
  static const Color infoColor = Color(0xFF3D3C67);
  static const Color successColor = Color(0xFF266C3A);
  static const Color errorColor = Color(0xFF7B3334);
  static const Color undoColor = Color(0xFFF2C98A);

  static const Duration _visible = Duration(milliseconds: 2500);
  static const Duration _errorVisible = Duration(milliseconds: 3500);

  /// How long a deleted or edited item can still be brought back.
  static const Duration undoWindow = Duration(seconds: 10);

  static String? _lastMessage;
  static DateTime _lastUntil = DateTime.fromMillisecondsSinceEpoch(0);

  static _PendingChange? _pending;
  static _FlushOnPause? _lifecycle;

  /// Neutral / informational message.
  static void info(BuildContext context, String message) =>
      _show(ScaffoldMessenger.maybeOf(context), message, infoColor, _visible);

  /// Confirmation of a completed action (green).
  static void success(BuildContext context, String message) =>
      _show(ScaffoldMessenger.maybeOf(context), message, successColor, _visible);

  /// Warning or error (red).
  static void error(BuildContext context, String message) =>
      _show(ScaffoldMessenger.maybeOf(context), message, errorColor, _errorVisible);

  /// Message for a delete or an edit, with a «لغو» button that works for [undoWindow].
  ///
  /// The caller shows the change on screen right away, but nothing reaches the
  /// server yet: [commit] runs only when the time is up (or earlier, when a newer
  /// undoable change takes its place or the app goes to the background).
  /// Tapping «لغو» calls [onUndo] instead, so the change is never applied.
  ///
  /// [commit] returns null when it worked, or the error text to show; on an error
  /// [onUndo] is called too, so the screen goes back to the real state.
  /// Both callbacks may run after the screen is gone: check `mounted` in them.
  static void undoable(
    BuildContext context,
    String message, {
    required Future<String?> Function() commit,
    VoidCallback? onUndo,
  }) {
    _lifecycle ??= _FlushOnPause()..attach();
    // Only one change waits at a time: the previous one is final now
    flushPending();

    final messenger = ScaffoldMessenger.maybeOf(context);
    final change = _PendingChange(commit, onUndo, messenger);
    if (messenger == null) {
      _commit(change);
      return;
    }
    change.timer = Timer(undoWindow, () => _commit(change));
    _pending = change;
    _lastMessage = null;

    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Directionality(
          textDirection: TextDirection.rtl,
          child: Row(
            children: [
              const _UndoCountdown(),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: AppTypography.bodyMedium.copyWith(color: textColor),
                ),
              ),
            ],
          ),
        ),
        action: SnackBarAction(
          label: 'لغو',
          textColor: undoColor,
          onPressed: () => _undo(change),
        ),
        // A message with a button would otherwise stay until closed by hand
        persist: false,
        backgroundColor: infoColor,
        behavior: SnackBarBehavior.floating,
        duration: undoWindow,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      snackBarAnimationStyle: AnimationStyle(
        duration: const Duration(milliseconds: 120),
        reverseDuration: const Duration(milliseconds: 100),
      ),
    );
  }

  /// Applies the change that is still waiting for its undo time, at once.
  static void flushPending() {
    final pending = _pending;
    if (pending != null) _commit(pending);
  }

  static void _commit(_PendingChange change) {
    if (change.done) return;
    change.done = true;
    change.timer?.cancel();
    if (identical(_pending, change)) _pending = null;
    Future<String?>.sync(change.commit).catchError((_) => 'انجام تغییر ممکن نشد. اتصال اینترنت را بررسی کنید.').then((error) {
      if (error == null) return;
      change.onUndo?.call();
      _show(change.messenger, error, errorColor, _errorVisible);
    });
  }

  static void _undo(_PendingChange change) {
    if (change.done) return;
    change.done = true;
    change.timer?.cancel();
    if (identical(_pending, change)) _pending = null;
    change.onUndo?.call();
  }

  static void _show(ScaffoldMessengerState? messenger, String message, Color color, Duration duration) {
    if (messenger == null || !messenger.mounted) return;

    final now = DateTime.now();
    if (message == _lastMessage && now.isBefore(_lastUntil)) return;
    _lastMessage = message;
    _lastUntil = now.add(duration);

    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Directionality(
          textDirection: TextDirection.rtl,
          child: Text(
            message,
            style: AppTypography.bodyMedium.copyWith(color: textColor),
          ),
        ),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        duration: duration,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      snackBarAnimationStyle: AnimationStyle(
        duration: const Duration(milliseconds: 120),
        reverseDuration: const Duration(milliseconds: 100),
      ),
    );
  }
}

class _PendingChange {
  _PendingChange(this.commit, this.onUndo, this.messenger);

  final Future<String?> Function() commit;
  final VoidCallback? onUndo;
  final ScaffoldMessengerState? messenger;
  Timer? timer;
  bool done = false;
}

/// When the app is sent to the background it may be closed, so a waiting change is applied then.
class _FlushOnPause with WidgetsBindingObserver {
  void attach() => WidgetsBinding.instance.addObserver(this);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      AppToast.flushPending();
    }
  }
}

/// A ring that empties over [AppToast.undoWindow], with the seconds left in it.
class _UndoCountdown extends StatelessWidget {
  const _UndoCountdown();

  @override
  Widget build(BuildContext context) {
    final total = AppToast.undoWindow.inSeconds;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1, end: 0),
      duration: AppToast.undoWindow,
      builder: (context, left, _) => SizedBox(
        width: 26,
        height: 26,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CircularProgressIndicator(
              value: left,
              strokeWidth: 2.2,
              color: AppToast.undoColor,
              backgroundColor: AppToast.textColor.withValues(alpha: 0.15),
            ),
            Text(
              (left * total).ceil().clamp(0, total).toString(),
              style: AppTypography.bodyMedium.copyWith(color: AppToast.textColor, fontSize: 11, height: 1),
            ),
          ],
        ),
      ),
    );
  }
}
