import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/tap_expander.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import 'nopa_dialog_container.dart';

/// Visual role of a [NopaModalAction].
enum NopaModalActionVariant {
  /// Camel outline: the main / confirming action.
  primary,

  /// Purple outline: cancel / dismiss.
  secondary,

  /// Red outline: destructive action.
  danger,
}

/// One standard action button of a [NopaModalShell].
class NopaModalAction {
  final String label;
  final VoidCallback? onPressed;
  final NopaModalActionVariant variant;
  final bool loading;

  const NopaModalAction({
    required this.label,
    required this.onPressed,
    this.variant = NopaModalActionVariant.primary,
    this.loading = false,
  });

  Color get color {
    switch (variant) {
      case NopaModalActionVariant.primary:
        return AppColors.buttonCamel;
      case NopaModalActionVariant.secondary:
        return AppColors.buttonCancelPurple;
      case NopaModalActionVariant.danger:
        return const Color(0xFFEF4444);
    }
  }
}

/// Unified modal frame: lavender station stroke + dark surface (via
/// [NopaDialogContainer]), optional gold header icon / title / subtitle,
/// arbitrary [child] content and a standard action row.
///
/// It only draws the frame; it never pops routes or owns state, so callers keep
/// their own `Navigator.pop` / `setState` logic unchanged.
class NopaModalShell extends StatelessWidget {
  final IconData? headerIcon;
  final String? title;
  final Widget? subtitle;
  final Widget? child;
  final List<NopaModalAction>? actions;
  final double radius;
  final double? maxWidth;

  /// Optional height cap. Use it together with `scrollable: false` when [child] holds its own
  /// scrolling list: the child is then given the remaining bounded height (it can use `Flexible`).
  final double? maxHeight;
  final EdgeInsetsGeometry padding;
  final bool scrollable;

  const NopaModalShell({
    super.key,
    this.headerIcon,
    this.title,
    this.subtitle,
    this.child,
    this.actions,
    this.radius = 24.0,
    this.maxWidth,
    this.maxHeight,
    this.padding = const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
    this.scrollable = true,
  });

  @override
  Widget build(BuildContext context) {
    final body = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (headerIcon != null) ...[
          Center(child: _HeaderIcon(icon: headerIcon!)),
          const SizedBox(height: 12),
        ],
        if (title != null)
          Text(
            title!,
            textAlign: TextAlign.center,
            style: AppTypography.title02Gold,
          ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          subtitle!,
        ],
        if (child != null) ...[
          if (title != null || headerIcon != null) const SizedBox(height: 16),
          if (scrollable) child! else Flexible(child: child!),
        ],
        if (actions != null && actions!.isNotEmpty) ...[
          const SizedBox(height: 22),
          _ActionRow(actions: actions!),
        ],
      ],
    );

    return NopaDialogContainer(
      radius: radius,
      maxWidth: maxWidth,
      constraints: maxHeight == null
          ? null
          : BoxConstraints(maxWidth: maxWidth ?? 420, maxHeight: maxHeight!),
      padding: padding,
      child: scrollable ? SingleChildScrollView(child: body) : body,
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  final IconData icon;
  const _HeaderIcon({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      padding: const EdgeInsets.all(1.2),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppColors.accentGradient,
      ),
      child: Container(
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.surfaceDarkEnd,
        ),
        child: Icon(icon, color: AppColors.accentGoldEnd, size: 24),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final List<NopaModalAction> actions;
  const _ActionRow({required this.actions});

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    for (var i = 0; i < actions.length; i++) {
      if (i > 0) children.add(const SizedBox(width: 12));
      children.add(Expanded(child: _ActionButton(action: actions[i])));
    }
    return Row(children: children);
  }
}

class _ActionButton extends StatelessWidget {
  final NopaModalAction action;
  const _ActionButton({required this.action});

  @override
  Widget build(BuildContext context) {
    // Disabled (no callback and not loading): dimmed like the app's other inactive controls
    final bool disabled = action.onPressed == null && !action.loading;
    final color = disabled ? action.color.withValues(alpha: 0.4) : action.color;
    return TapExpander(
      child: InkWell(
        onTap: action.loading ? null : action.onPressed,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color, width: 1.2),
          ),
          child: action.loading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: color),
                )
              : Text(
                  action.label,
                  textAlign: TextAlign.center,
                  style: AppTypography.h3.copyWith(color: color),
                ),
        ),
      ),
    );
  }
}

/// Shows [builder] inside the standard RTL transparent [Dialog] wrapper.
/// The builder normally returns a [NopaModalShell].
Future<T?> showNopaModal<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool barrierDismissible = true,
  EdgeInsets insetPadding = const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        insetPadding: insetPadding,
        child: builder(ctx),
      ),
    ),
  );
}

/// Bottom sheet with the same dark surface + stroke as [NopaModalShell].
Future<T?> showNopaSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool isScrollControlled = false,
  bool isDismissible = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    isDismissible: isDismissible,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: const EdgeInsets.only(top: 1.3),
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          gradient: AppColors.stationStrokeGradient,
        ),
        child: Container(
          decoration: const BoxDecoration(
            borderRadius: BorderRadius.vertical(top: Radius.circular(22.7)),
            gradient: AppColors.screenBackgroundGradient,
          ),
          child: SafeArea(top: false, child: builder(ctx)),
        ),
      ),
    ),
  );
}
