import 'package:flutter/material.dart';

class SafeAvatar extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double radius;
  final Color? backgroundColor;

  const SafeAvatar({
    super.key,
    this.imageUrl,
    required this.name,
    this.radius = 20,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isNotEmpty ? name.trim()[0] : '؟';
    final hasValidUrl = imageUrl != null && imageUrl!.startsWith('http');

    if (!hasValidUrl) {
      return _buildFallback(initial);
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor ?? Colors.indigo.shade800,
      child: ClipOval(
        child: Image.network(
          imageUrl!,
          width: radius * 2,
          height: radius * 2,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => _buildFallback(initial),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return _buildFallback(initial);
          },
        ),
      ),
    );
  }

  Widget _buildFallback(String initial) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor ?? const Color(0xFF334155),
      child: Text(
        initial,
        style: TextStyle(
          color: Colors.white,
          fontSize: radius * 0.9,
          fontWeight: FontWeight.bold,
          fontFamily: 'Vazirmatn',
        ),
      ),
    );
  }
}
