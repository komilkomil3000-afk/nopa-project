import 'package:flutter/material.dart' as m;
import 'package:flutter/widgets.dart';

/// Converts ASCII digits to Persian digits. Strings that look like links are left untouched.
String faDigits(String input) {
  if (input.isEmpty || input.contains('://')) return input;
  final buf = StringBuffer();
  var changed = false;
  for (final unit in input.codeUnits) {
    if (unit >= 0x30 && unit <= 0x39) {
      buf.writeCharCode(0x06F0 + (unit - 0x30));
      changed = true;
    } else {
      buf.writeCharCode(unit);
    }
  }
  return changed ? buf.toString() : input;
}

InlineSpan _faSpan(InlineSpan span) {
  if (span is TextSpan) {
    return TextSpan(
      text: span.text == null ? null : faDigits(span.text!),
      children: span.children?.map(_faSpan).toList(),
      style: span.style,
      recognizer: span.recognizer,
      mouseCursor: span.mouseCursor,
      onEnter: span.onEnter,
      onExit: span.onExit,
      semanticsLabel: span.semanticsLabel,
      locale: span.locale,
      spellOut: span.spellOut,
    );
  }
  return span;
}

/// Drop-in replacement for [m.Text] that always shows Persian digits (۰-۹).
/// Files import this instead of the material Text (hide it from material.dart).
/// Constructors stay const; digits are converted at build time.
class Text extends m.Text {
  const Text(
    super.data, {
    super.key,
    super.style,
    super.strutStyle,
    super.textAlign,
    super.textDirection,
    super.locale,
    super.softWrap,
    super.overflow,
    super.textScaler,
    super.maxLines,
    super.semanticsLabel,
    super.semanticsIdentifier,
    super.textWidthBasis,
    super.textHeightBehavior,
    super.selectionColor,
  });

  const Text.rich(
    super.textSpan, {
    super.key,
    super.style,
    super.strutStyle,
    super.textAlign,
    super.textDirection,
    super.locale,
    super.softWrap,
    super.overflow,
    super.textScaler,
    super.maxLines,
    super.semanticsLabel,
    super.semanticsIdentifier,
    super.textWidthBasis,
    super.textHeightBehavior,
    super.selectionColor,
  }) : super.rich();

  @override
  Widget build(BuildContext context) {
    if (textSpan != null) {
      return m.Text.rich(
        _faSpan(textSpan!),
        style: style,
        strutStyle: strutStyle,
        textAlign: textAlign,
        textDirection: textDirection,
        locale: locale,
        softWrap: softWrap,
        overflow: overflow,
        textScaler: textScaler,
        maxLines: maxLines,
        semanticsLabel: semanticsLabel,
        semanticsIdentifier: semanticsIdentifier,
        textWidthBasis: textWidthBasis,
        textHeightBehavior: textHeightBehavior,
        selectionColor: selectionColor,
      );
    }
    return m.Text(
      faDigits(data ?? ''),
      style: style,
      strutStyle: strutStyle,
      textAlign: textAlign,
      textDirection: textDirection,
      locale: locale,
      softWrap: softWrap,
      overflow: overflow,
      textScaler: textScaler,
      maxLines: maxLines,
      semanticsLabel: semanticsLabel,
      semanticsIdentifier: semanticsIdentifier,
      textWidthBasis: textWidthBasis,
      textHeightBehavior: textHeightBehavior,
      selectionColor: selectionColor,
    );
  }
}
