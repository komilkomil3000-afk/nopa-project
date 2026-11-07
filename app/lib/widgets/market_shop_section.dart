import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';
import 'package:nopa_app/core/asset_names.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/shop_service.dart';
import 'package:nopa_app/utils/constants.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/nopa_dialog_container.dart';
import 'package:nopa_app/widgets/nopa_entrance.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';

/// «فروشگاه» in the بازارچه: sticker packs, GIF packs and features the admin sells for zarik (panel → فروشگاه بازارچه).
/// Until something is on sale it says so. A bought pack is used from the sticker button of the chat composer.
class MarketShopSection extends StatefulWidget {
  const MarketShopSection({super.key});

  @override
  State<MarketShopSection> createState() => MarketShopSectionState();
}

class MarketShopSectionState extends State<MarketShopSection> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _failed = false;
  String? _buying;

  static const _kindLabel = {'sticker_pack': 'پک استیکر', 'gif_pack': 'پک گیف', 'feature': 'قابلیت'};

  @override
  void initState() {
    super.initState();
    reload();
  }

  /// Pull to refresh of the market calls this too.
  Future<void> reload() async {
    final data = await HttpApiService().getShop();
    if (!mounted) return;
    setState(() {
      _loading = false;
      _failed = data == null;
      if (data != null) {
        _items = ((data['items'] as List?) ?? const []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
      }
    });
  }

  static int _int(dynamic v) => v is num ? v.toInt() : (int.tryParse(v?.toString() ?? '') ?? 0);

  String _price(Map<String, dynamic> item) {
    final p = _int(item['priceZarik']);
    return p == 0 ? 'رایگان' : '${p.toString().toPersianDigits()} ${AssetNames.of('zarik')}';
  }

  Future<void> _buy(Map<String, dynamic> item) async {
    final id = item['id']?.toString() ?? '';
    if (id.isEmpty || _buying != null) return;
    final repository = Provider.of<AppRepository>(context, listen: false);
    if (repository.currentUser.zarik < _int(item['priceZarik'])) {
      AppToast.error(context, '${AssetNames.of('zarik')} شما برای این خرید کافی نیست.');
      return;
    }
    setState(() => _buying = id);
    final error = await HttpApiService().buyShopItem(id);
    if (!mounted) return;
    setState(() => _buying = null);
    if (error != null) {
      AppToast.error(context, error);
      return;
    }
    AppToast.success(context, item['kind'] == 'feature'
        ? '«${item['title']}» برای شما فعال شد'
        : '«${item['title']}» خریداری شد؛ از دکمه‌ی استیکر در چت‌ها استفاده کنید');
    repository.refreshUser();
    MyShop.load(force: true);
    reload();
  }

  void _openItem(Map<String, dynamic> item) {
    final stickers = ((item['assets'] as List?) ?? const []).whereType<Map>().toList();
    final owned = item['owned'] == true;
    showNopaDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: NopaDialogContainer(
            maxWidth: 440,
            radius: 22,
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(item['title']?.toString() ?? '', textAlign: TextAlign.center, style: AppTypography.h2),
                const SizedBox(height: 4),
                Text(
                  item['kind'] == 'feature' ? (item['featureLabel']?.toString() ?? 'قابلیت') : (_kindLabel[item['kind']] ?? ''),
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(color: const Color(0xFFB3AFD0)),
                ),
                if ((item['description']?.toString() ?? '').isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(item['description'].toString(), textAlign: TextAlign.justify, style: AppTypography.bodyMedium.copyWith(color: const Color(0xFFD6D3E6))),
                ],
                if (stickers.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 260),
                    child: GridView.count(
                      shrinkWrap: true,
                      crossAxisCount: 4,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      children: stickers.map((s) => _image(s['url']?.toString(), fit: BoxFit.contain)).toList(),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: owned
                          ? null
                          : () {
                              Navigator.pop(ctx);
                              _buy(item);
                            },
                      child: Text(
                        owned ? 'خریداری شده' : 'خرید با ${_price(item)}',
                        style: AppTypography.h3Strong.copyWith(color: owned ? const Color(0xFF8E8AB0) : AppColors.buttonCamel),
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: Text('بستن', style: AppTypography.h3Strong.copyWith(color: AppColors.buttonCancelPurple)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _image(String? url, {BoxFit fit = BoxFit.cover}) {
    final resolved = ApiConstants.resolveImageUrl(url);
    if (resolved.isEmpty) return const Icon(Icons.storefront_rounded, color: Color(0xFFB9B4E8), size: 34);
    return CachedNetworkImage(
      imageUrl: resolved,
      fit: fit,
      errorWidget: (_, _, _) => const Icon(Icons.broken_image_outlined, color: Color(0xFF8E8AB0)),
      placeholder: (_, _) => const SizedBox.shrink(),
    );
  }

  Widget _card(Map<String, dynamic> item) {
    final owned = item['owned'] == true;
    final busy = _buying == item['id'];
    return GestureDetector(
      onTap: () => _openItem(item),
      child: Container(
        width: 128,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(colors: [Color(0xFF3A3A6A), Color(0xFF9292E2), Color(0xFF3A3A6A)], stops: [0.0, 0.5, 1.0]),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 5))],
        ),
        padding: const EdgeInsets.all(1.2),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18.8),
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF3D3C67), Color(0xFF36345C), Color(0xFF333359)],
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18.8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 10, 10, 4),
                    child: Column(
                      children: [
                        Expanded(child: Center(child: _image(item['coverUrl']?.toString(), fit: BoxFit.contain))),
                        const SizedBox(height: 6),
                        Text(item['title']?.toString() ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: AppTypography.h3),
                        Text(_kindLabel[item['kind']] ?? '', style: AppTypography.caption.copyWith(color: const Color(0xFFB3AFD0))),
                      ],
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                  color: owned ? const Color(0xFF26402F) : const Color(0xFF23223D),
                  child: Center(
                    child: busy
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(
                            owned ? 'خریداری شده' : _price(item),
                            style: AppTypography.caption.copyWith(color: owned ? const Color(0xFFA5D6A7) : const Color(0xFFFFD580)),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const SizedBox(height: 90, child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.4))));
    } else if (_items.isEmpty) {
      body = Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          decoration: BoxDecoration(
            color: const Color(0xFF282548).withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF6C649B).withValues(alpha: 0.28)),
          ),
          child: Row(
            children: [
              const Icon(Icons.storefront_rounded, color: Color(0xFFB9B4E8), size: 26),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  _failed ? 'دریافت فروشگاه ناموفق بود؛ برای تلاش دوباره صفحه را پایین بکشید.' : 'فعلاً محصولی برای فروش نیامده است.',
                  style: AppTypography.bodyMedium.copyWith(color: const Color(0xFFD6D3E6)),
                ),
              ),
            ],
          ),
        ),
      );
    } else {
      body = SizedBox(
        height: 168,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          itemCount: _items.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (_, i) => NopaEntrance(entranceKey: 'market-shop:${_items[i]['id']}', index: i, child: _card(_items[i])),
        ),
      );
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Text('فروشگاه', style: AppTypography.h2),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'استیکر، گیف و قابلیت‌های چت',
                    style: AppTypography.caption.copyWith(color: const Color(0xFF9E9AC0)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          body,
        ],
      ),
    );
  }
}
