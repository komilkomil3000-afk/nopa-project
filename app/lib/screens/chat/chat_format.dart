import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Light formatting inside a chat message, written as markers so every client and the panel can read it:
/// `**bold**`, `__italic__`, `@name` mentions and links.
class ChatFormat {
  ChatFormat._();

  static const String bold = '**';
  static const String italic = '__';

  static final RegExp _token = RegExp(r'(\*\*(.+?)\*\*)|(__(.+?)__)|(https?://[^\s]+)|(@[^\s@]+(?: [^\s@،.,!؟?]+)?)', dotAll: true);
  static final RegExp _markers = RegExp(r'\*\*(.+?)\*\*|__(.+?)__', dotAll: true);

  /// The text with its markers removed, for previews and notifications.
  static String plain(String text) => text.replaceAllMapped(_markers, (m) => m.group(1) ?? m.group(2) ?? '');

  /// Wraps the selected part of [value] in [marker], or unwraps it if it is wrapped already.
  static TextEditingValue toggle(TextEditingValue value, String marker) {
    final sel = value.selection;
    if (!sel.isValid || sel.isCollapsed) return value;
    final text = value.text;
    final start = sel.start, end = sel.end;
    final before = text.substring(0, start), inner = text.substring(start, end), after = text.substring(end);
    if (before.endsWith(marker) && after.startsWith(marker)) {
      final t = before.substring(0, before.length - marker.length) + inner + after.substring(marker.length);
      return TextEditingValue(text: t, selection: TextSelection(baseOffset: start - marker.length, extentOffset: end - marker.length));
    }
    final t = '$before$marker$inner$marker$after';
    return TextEditingValue(text: t, selection: TextSelection(baseOffset: start + marker.length, extentOffset: end + marker.length));
  }

  /// Spans of a message: bold, italic, highlighted mentions and tappable links.
  static List<InlineSpan> spans(String text, {required Color linkColor, required Color mentionColor, Set<String> mentionNames = const {}}) {
    final spans = <InlineSpan>[];
    var at = 0;
    for (final m in _token.allMatches(text)) {
      if (m.start > at) spans.add(TextSpan(text: text.substring(at, m.start)));
      if (m.group(1) != null) {
        spans.add(TextSpan(text: m.group(2), style: const TextStyle(fontWeight: FontWeight.w800)));
      } else if (m.group(3) != null) {
        spans.add(TextSpan(text: m.group(4), style: const TextStyle(fontStyle: FontStyle.italic)));
      } else if (m.group(5) != null) {
        final url = m.group(5)!;
        spans.add(TextSpan(
          text: url,
          style: TextStyle(color: linkColor, decoration: TextDecoration.underline, decorationColor: linkColor),
          recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
        ));
      } else {
        // A two-word mention counts only when that is a known name; otherwise its first word alone
        var mention = m.group(6)!;
        if (mention.contains(' ') && !mentionNames.contains(mention.substring(1))) mention = mention.split(' ').first;
        spans.add(TextSpan(text: mention, style: TextStyle(color: mentionColor, fontWeight: FontWeight.bold)));
        if (mention.length < m.group(6)!.length) spans.add(TextSpan(text: m.group(6)!.substring(mention.length)));
      }
      at = m.end;
    }
    if (at < text.length) spans.add(TextSpan(text: text.substring(at)));
    return spans;
  }
}
