import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/widgets/fa_text.dart';

/// One choice in a message's menu.
class ChatMenuItem {
  final String value;
  final IconData icon;
  final String label;
  final bool danger;
  const ChatMenuItem(this.value, this.icon, this.label, {this.danger = false});
}

/// The menu now open, so a screen that goes away can take it along.
VoidCallback? _closeOpenMenu;

/// Closes the message menu if one is open (e.g. when its conversation is left).
void dismissChatMessageMenu() => _closeOpenMenu?.call();

/// Opens a message's menu beside it: the reactions on a light bar, the choices on a light card under it
/// (or over it, near the bottom of the screen). Returns `react:<type>` or a choice's value.
///
/// It is an overlay, not a route: the text field keeps its focus, so an open keyboard (and the composer on
/// top of it) stays where it is while the person reacts.
Future<String?> showChatMessageMenu(
  BuildContext context, {
  required Rect anchor,
  required bool alignRight,
  required List<ChatMenuItem> items,
  bool showReactions = true,
  Set<String> myReactions = const {},
}) {
  dismissChatMessageMenu();
  final done = Completer<String?>();
  late final OverlayEntry entry;
  late final VoidCallback cancel;
  void close(String? value) {
    if (done.isCompleted) return;
    entry.remove();
    if (identical(_closeOpenMenu, cancel)) _closeOpenMenu = null;
    done.complete(value);
  }

  cancel = () => close(null);
  _closeOpenMenu = cancel;
  entry = OverlayEntry(
    builder: (ctx) => TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOut,
      builder: (ctx, t, child) => Opacity(opacity: t, child: Transform.scale(scale: 0.96 + 0.04 * t, child: child)),
      child: _ChatMessageMenu(anchor: anchor, alignRight: alignRight, items: items, showReactions: showReactions, myReactions: myReactions, onClose: close),
    ),
  );
  Overlay.of(context, rootOverlay: true).insert(entry);
  return done.future;
}

class _ChatMessageMenu extends StatelessWidget {
  final Rect anchor;
  final bool alignRight;
  final List<ChatMenuItem> items;
  final bool showReactions;
  final Set<String> myReactions;
  final void Function(String? value) onClose;

  const _ChatMessageMenu({required this.anchor, required this.alignRight, required this.items, required this.showReactions, required this.myReactions, required this.onClose});

  static const double _menuWidth = 230;
  static const double _itemHeight = 44;
  static const double _reactionsHeight = 52;
  static const double _gap = 8;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final padding = MediaQuery.paddingOf(context);
    final top = padding.top + 12;
    // Above the keyboard when it is open
    final bottom = size.height - math.max(padding.bottom, MediaQuery.viewInsetsOf(context).bottom) - 12;
    final menuHeight = items.length * _itemHeight + 12;
    final reactionsWidth = math.min(size.width - ChatTheme.gutter * 2, ChatTheme.reactions.length * 48.0 + 16);

    // Reactions just over the message and the menu just under it; near the bottom both go over it
    final above = showReactions ? _reactionsHeight + _gap : 0.0;
    double menuTop = anchor.bottom + _gap;
    double reactionsTop = anchor.top - _reactionsHeight - _gap;
    if (menuTop + menuHeight > bottom) {
      menuTop = anchor.top - _gap - menuHeight;
      if (menuTop - above < top) menuTop = bottom - menuHeight; // a tall message: the menu covers its end
      reactionsTop = menuTop - above;
    }
    reactionsTop = reactionsTop.clamp(top, math.max(top, bottom - _reactionsHeight));

    double horizontal(double width) {
      final left = alignRight ? anchor.right - width : anchor.left;
      return left.clamp(ChatTheme.gutter, size.width - ChatTheme.gutter - width);
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onClose(null),
              child: ColoredBox(color: Colors.black.withValues(alpha: 0.45)),
            ),
          ),
          if (showReactions)
            Positioned(
              top: reactionsTop,
              left: horizontal(reactionsWidth),
              width: reactionsWidth,
              height: _reactionsHeight,
              child: _Reactions(myReactions: myReactions, onPick: onClose),
            ),
          if (items.isNotEmpty)
            Positioned(
              top: menuTop,
              left: horizontal(_menuWidth),
              width: _menuWidth,
              child: Material(
                color: ChatTheme.paper,
                elevation: 10,
                shadowColor: Colors.black54,
                borderRadius: BorderRadius.circular(14),
                clipBehavior: Clip.antiAlias,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (var i = 0; i < items.length; i++) ...[
                        if (i > 0 && items[i].danger && !items[i - 1].danger) Divider(height: 1, color: ChatTheme.ink.withValues(alpha: 0.08)),
                        InkWell(
                          onTap: () => onClose(items[i].value),
                          child: SizedBox(
                            height: _itemHeight,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Row(
                                children: [
                                  Icon(items[i].icon, size: 19, color: items[i].danger ? ChatTheme.danger : ChatTheme.ink.withValues(alpha: 0.75)),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      items[i].label,
                                      style: TextStyle(
                                        color: items[i].danger ? ChatTheme.danger : ChatTheme.ink,
                                        fontFamily: AppTheme.fontFamily,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Reactions extends StatelessWidget {
  final Set<String> myReactions;
  final void Function(String value) onPick;
  const _Reactions({required this.myReactions, required this.onPick});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: ChatTheme.paper,
      elevation: 10,
      shadowColor: Colors.black54,
      borderRadius: BorderRadius.circular(26),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            for (final entry in ChatTheme.reactions.entries)
              Tooltip(
                message: entry.value.label,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => onPick('react:${entry.key}'),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: myReactions.contains(entry.key) ? ChatTheme.accent.withValues(alpha: 0.45) : Colors.transparent,
                    ),
                    child: Icon(entry.value.icon, color: myReactions.contains(entry.key) ? ChatTheme.ink : AppColors.buttonCamel, size: 24),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
