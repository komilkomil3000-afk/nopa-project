import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/widgets/fa_text.dart';

/// An explanation kept out of the way: only a small «ⓘ [label]» shows; a tap opens [text] under it, another tap closes it.
class InfoReveal extends StatefulWidget {
  final String text;
  final String label;
  const InfoReveal({super.key, required this.text, this.label = 'نحوه‌ی محاسبه'});

  @override
  State<InfoReveal> createState() => _InfoRevealState();
}

class _InfoRevealState extends State<InfoReveal> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    const muted = Color(0xFF9E9AC0);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(_open ? Icons.expand_less_rounded : Icons.info_outline_rounded, size: 15, color: muted),
                  const SizedBox(width: 4),
                  Text(widget.label, style: AppTypography.caption.copyWith(color: muted, fontSize: 11)),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            alignment: Alignment.topCenter,
            child: _open
                ? Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      widget.text,
                      textAlign: TextAlign.center,
                      style: AppTypography.caption.copyWith(color: muted, fontSize: 11),
                    ),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );
  }
}
