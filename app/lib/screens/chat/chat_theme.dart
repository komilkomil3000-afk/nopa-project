import 'package:flutter/material.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';

/// Chat's look, taken from the app's own tokens and the values of the bottom bar.
class ChatTheme {
  ChatTheme._();

  static const Color surfaceTop = Color(0xFF282548);
  static const Color surfaceBottom = Color(0xFF1B1834);
  static const Color stroke = Color(0xFF656196);
  static const Color accent = Color(0xFFDFB690);
  static const Color lavender = Color(0xFF9292E2);
  static const Color text = Color(0xFFEDE9F6);
  static const Color muted = Color(0xFF8B88A8);
  static const Color danger = Color(0xFFEF4444);

  /// Dark ink on the golden header and on the light composer and menus.
  static const Color ink = Color(0xFF23223D);
  /// Light surface of the composer, the filter bar and the message menu.
  static const Color paper = text;
  /// Fill of one's own bubble, a step lighter than the cards.
  static const Color mineFill = Color(0xFF3B3870);
  static const Color online = AppColors.emerald;

  /// Side margin every chat element keeps from the screen edges.
  static const double gutter = 16;

  /// The golden header of every chat screen, rounded at the bottom.
  static BoxDecoration get header => BoxDecoration(
        gradient: const RadialGradient(
          center: Alignment(0, -1.6),
          radius: 1.6,
          colors: [AppColors.accentGoldEnd, AppColors.buttonCamel],
        ),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(26)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 18, offset: const Offset(0, 6))],
      );

  static const double radius = AppColors.borderRadiusValue;

  /// One shape for every chat dialog and bottom sheet: card stroke, larger corner than a card.
  static final ShapeBorder dialogShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(20),
    side: BorderSide(color: stroke.withValues(alpha: 0.55), width: 1.2),
  );
  static final ShapeBorder sheetShape = RoundedRectangleBorder(
    borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
    side: BorderSide(color: stroke.withValues(alpha: 0.55), width: 1.2),
  );

  static BoxDecoration card({bool highlighted = false}) => BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [surfaceTop, surfaceBottom],
        ),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: (highlighted ? accent : stroke).withValues(alpha: 0.55), width: 1.2),
      );

  /// Bar of a conversation one cannot write in: the colour of the app's general feedback (toasts).
  static const Color feedback = Color(0xFF3D3C67);
  static const Color feedbackText = Color(0xFFE4E4FF);

  /// A mentor, wherever they appear (name, challenge creator, reactions, marks): this blue and this badge.
  static const Color mentor = AppColors.blue;
  static const IconData mentorBadge = Icons.verified_rounded;

  /// One's own bubble: the window of a station (lavender edge, deep fill).
  static const LinearGradient mineStroke = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    stops: [0.0, 0.5, 1.0],
    colors: [Color(0xFF3A3A6A), Color(0xFF9292E2), Color(0xFF3A3A6A)],
  );
  static const LinearGradient mineFillGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.53, 1.0],
    colors: [Color(0xFF3D3C67), Color(0xFF36345C), Color(0xFF333359)],
  );

  /// Everyone else's bubble: camel, the family of the header's [AppColors.buttonCamel] but a touch
  /// brighter so it doesn't melt into it. Three text tones keep the hierarchy readable on it.
  // (names kept from the earlier camel look; the colours are now the green of received messages)
  static const Color goldFill = Color(0xFF3B6149);
  static const Color goldFillDeep = Color(0xFF34573F);
  /// Body text on the green bubble.
  static const Color goldInk = Color(0xFFF1F6F2);
  /// Sender name, titles, links and icons on the green bubble.
  static const Color goldTitle = Color(0xFFA8E6C3);
  /// Time, ticks and captions on the green bubble.
  static const Color goldMeta = Color(0xFFB4CDBD);

  static const LinearGradient otherStroke = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    stops: [0.0, 0.5, 1.0],
    colors: [Color(0xFF2F5A43), Color(0xFF8AD3AE), Color(0xFF2F5A43)],
  );
  static const LinearGradient otherFillGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [goldFill, goldFillDeep],
  );

  /// Fill under the tail, where the bubble meets its sender's face.
  static Color bubbleFill({required bool mine}) => mine ? const Color(0xFF333359) : goldFill;
  static Color tailStroke({required bool mine}) => mine ? const Color(0xFF5B5B9E) : const Color(0xFF7FCBA3);
  static Color bubbleText({required bool mine}) => mine ? text : goldInk;
  static Color bubbleMuted({required bool mine}) => mine ? muted : goldMeta;

  static const TextStyle body = TextStyle(color: text, fontFamily: AppTheme.fontFamily, fontSize: 13.5, height: 1.6);
  static const TextStyle title = TextStyle(color: text, fontFamily: AppTheme.fontFamily, fontSize: 14, fontWeight: FontWeight.bold);
  static const TextStyle caption = TextStyle(color: muted, fontFamily: AppTheme.fontFamily, fontSize: 11);

  /// The reactions one can pick, in order.
  static const Map<String, ({String emoji, String label})> reactions = {
    'like': (emoji: '👍', label: 'تایید'),
    'dislike': (emoji: '👎', label: 'مخالف'),
    'idea': (emoji: '💡', label: 'ایده'),
    'flower': (emoji: '🌸', label: 'گل'),
    'thanks': (emoji: '🙏', label: 'ممنون'),
  };

  /// The extra reaction only mentors have: it marks a message as a top one ("#برتر" in search lists them).
  static const String starReaction = 'star';

  /// Reactions given before the current set: still shown, no longer offered.
  static const Map<String, String> legacyReactions = {'bravo': '👏', 'agree': '✅', 'question': '❓', 'confused': '😕'};

  static String emojiOf(String type) => reactions[type]?.emoji ?? legacyReactions[type] ?? '⭐';
}
