import 'package:flutter/material.dart' hide Text;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/widgets/fa_text.dart';

/// Chat tab. Lists the conversations once the chat core is in place.
class ChatHomeScreen extends StatelessWidget {
  const ChatHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ChatNotice(
      title: 'گفتگوها',
      message: 'گفتگوهای کاروان و کانال‌های نپا به‌زودی اینجا نمایش داده می‌شوند.',
    );
  }
}

/// Centered icon and text, for an empty or unavailable chat section.
class ChatNotice extends StatelessWidget {
  final String title;
  final String message;

  const ChatNotice({super.key, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SvgPicture.asset(
                'assets/svg_icons/chat01.svg',
                width: 56,
                height: 56,
                colorFilter: const ColorFilter.mode(Color(0xFF9292E2), BlendMode.srcIn),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(
                  color: Color(0xFFEDE9F6),
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF8B88A8),
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 13,
                  height: 1.7,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
