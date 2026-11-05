import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/services/api_service.dart';

/// Banner slider whose pictures come from the admin panel (Jarchi tab → «بنرهای اپ»), filtered by [position]
/// (e.g. `challenges_top`). While the panel has no active banner for the position, the built-in picture is shown.
class PanelBannerStrip extends StatefulWidget {
  final String position;
  final double height;
  final double viewportFraction;
  final double radius;

  const PanelBannerStrip({
    super.key,
    required this.position,
    this.height = 82,
    this.viewportFraction = 0.92,
    this.radius = 18,
  });

  @override
  State<PanelBannerStrip> createState() => _PanelBannerStripState();
}

class _PanelBannerStripState extends State<PanelBannerStrip> {
  static const _fallbackAsset = 'assets/images/banners/banner1.jpg';

  late final PageController _ctrl = PageController(viewportFraction: widget.viewportFraction);
  List<Map<String, dynamic>> _banners = [];
  int _index = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      final total = _banners.isNotEmpty ? _banners.length : 3;
      if (!mounted || !_ctrl.hasClients || total < 2) return;
      _ctrl.animateToPage(
        (_index + 1) % total,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  Future<void> _load() async {
    try {
      final list = await HttpApiService().getBanners(position: widget.position, forceRefresh: true);
      if (!mounted) return;
      setState(() {
        _banners = List<Map<String, dynamic>>.from(list);
        if (_index >= _banners.length) _index = 0;
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  Widget _fallback() => Image.asset(
        _fallbackAsset,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        errorBuilder: (context, error, stackTrace) => Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF5A3825), Color(0xFF382318)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final count = _banners.isNotEmpty ? _banners.length : 3;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: widget.height,
          child: PageView.builder(
            controller: _ctrl,
            itemCount: count,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) {
              final raw = _banners.isNotEmpty ? _banners[i]['imageUrl']?.toString().trim() : null;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(widget.radius),
                  child: raw != null && raw.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: ApiConstants.resolveImageUrl(raw),
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          memCacheWidth: 600,
                          placeholder: (context, url) => Container(color: const Color(0xFF231C38)),
                          errorWidget: (context, url, error) => _fallback(),
                        )
                      : _fallback(),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        if (count > 1)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(count, (i) {
              final active = _index == i;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active ? const Color(0xFFCD8449) : Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
      ],
    );
  }
}
