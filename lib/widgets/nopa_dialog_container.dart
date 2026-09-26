import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

/// Reusable Unified Dialog Frame with Station Card Stroke Gradient and Login Background
class NopaDialogContainer extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry padding;
  final BoxConstraints? constraints;
  final double? maxWidth;

  const NopaDialogContainer({
    super.key,
    required this.child,
    this.radius = 24.0,
    this.padding = const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
    this.constraints,
    this.maxWidth,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: constraints ?? (maxWidth != null ? BoxConstraints(maxWidth: maxWidth!) : const BoxConstraints(maxWidth: 420)),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: AppColors.stationStrokeGradient,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 24,
            spreadRadius: 2,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.3), // Gradient border width (station stroke)
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius - 1.3),
          gradient: AppColors.screenBackgroundGradient,
          image: const DecorationImage(
            image: AssetImage('assets/images/login_bg.png'),
            fit: BoxFit.cover,
          ),
        ),
        child: child,
      ),
    );
  }
}
