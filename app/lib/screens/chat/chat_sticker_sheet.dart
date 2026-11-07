import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/shop_service.dart';
import 'package:nopa_app/widgets/fa_text.dart';

/// The chat's sticker picker: one tab per sticker / GIF pack bought in the market's shop.
/// Returns the picked sticker ({id, url, kind}) or null.
Future<Map<String, dynamic>?> showChatStickerSheet(BuildContext context) {
  MyShop.load(force: true);
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    backgroundColor: const Color(0xFF26243F),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
    builder: (ctx) => const Directionality(textDirection: TextDirection.rtl, child: _StickerSheet()),
  );
}

class _StickerSheet extends StatefulWidget {
  const _StickerSheet();

  @override
  State<_StickerSheet> createState() => _StickerSheetState();
}

class _StickerSheetState extends State<_StickerSheet> {
  int _pack = 0;

  Widget _img(String? url) {
    final resolved = ApiConstants.resolveImageUrl(url);
    if (resolved.isEmpty) return const SizedBox.shrink();
    return CachedNetworkImage(
      imageUrl: resolved,
      fit: BoxFit.contain,
      placeholder: (_, _) => const SizedBox.shrink(),
      errorWidget: (_, _, _) => const Icon(Icons.broken_image_outlined, color: Color(0xFF8E8AB0)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.45,
        child: ValueListenableBuilder<List<ShopPack>>(
          valueListenable: MyShop.packs,
          builder: (context, packs, _) {
            if (packs.isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    MyShop.loaded
                        ? 'هنوز پک استیکر یا گیفی ندارید.\nاز «فروشگاه» در بازارچه می‌توانید بخرید.'
                        : 'در حال دریافت بسته‌های شما...',
                    textAlign: TextAlign.center,
                    style: AppTypography.bodyMedium.copyWith(color: ChatTheme.ink.withValues(alpha: 0.8)),
                  ),
                ),
              );
            }
            final index = _pack.clamp(0, packs.length - 1);
            final pack = packs[index];
            return Column(
              children: [
                const SizedBox(height: 10),
                Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
                SizedBox(
                  height: 58,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    itemCount: packs.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => GestureDetector(
                      onTap: () => setState(() => _pack = i),
                      child: Container(
                        width: 42,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: i == index ? Colors.white.withValues(alpha: 0.14) : Colors.transparent,
                          border: Border.all(color: i == index ? const Color(0xFF9292E2) : Colors.white12),
                        ),
                        padding: const EdgeInsets.all(4),
                        child: _img(packs[i].coverUrl ?? (packs[i].stickers.isNotEmpty ? packs[i].stickers.first.url : null)),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(pack.title, style: AppTypography.caption.copyWith(color: ChatTheme.ink.withValues(alpha: 0.7))),
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, mainAxisSpacing: 10, crossAxisSpacing: 10),
                    itemCount: pack.stickers.length,
                    itemBuilder: (_, i) {
                      final s = pack.stickers[i];
                      return GestureDetector(
                        onTap: () => Navigator.pop(context, {'id': s.id, 'url': s.url, 'kind': s.kind, 'itemId': pack.id, 'itemTitle': pack.title}),
                        child: _img(s.url),
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
