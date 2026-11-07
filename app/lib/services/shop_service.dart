import 'package:flutter/foundation.dart';
import 'package:nopa_app/services/api_service.dart';

/// One sticker or GIF of a pack bought in the market.
class ShopSticker {
  final String id;
  final String url;
  final String kind; // sticker | gif
  const ShopSticker({required this.id, required this.url, required this.kind});

  factory ShopSticker.fromJson(Map<String, dynamic> j) =>
      ShopSticker(id: j['id']?.toString() ?? '', url: j['url']?.toString() ?? '', kind: j['kind']?.toString() ?? 'sticker');
}

/// A sticker / GIF pack the user owns (shown as a tab in the chat's sticker picker).
class ShopPack {
  final String id;
  final String title;
  final String kind; // sticker_pack | gif_pack
  final String? coverUrl;
  final List<ShopSticker> stickers;
  const ShopPack({required this.id, required this.title, required this.kind, this.coverUrl, required this.stickers});

  factory ShopPack.fromJson(Map<String, dynamic> j) => ShopPack(
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        kind: j['kind']?.toString() ?? 'sticker_pack',
        coverUrl: j['coverUrl']?.toString(),
        stickers: ((j['assets'] as List?) ?? const []).whereType<Map>().map((a) => ShopSticker.fromJson(Map<String, dynamic>.from(a))).toList(),
      );
}

/// What the user bought in the market's shop, kept for the chat: the packs (sticker picker) and whether
/// GIF files may be sent. Reloaded after a purchase and when the picker opens.
class MyShop {
  MyShop._();

  static final ValueNotifier<List<ShopPack>> packs = ValueNotifier<List<ShopPack>>(const []);
  /// Sending GIF files in chat (free until the admin sells it as a feature).
  static final ValueNotifier<bool> canSendGif = ValueNotifier<bool>(true);
  static bool _loaded = false;
  static Future<void>? _loading;

  static bool get loaded => _loaded;

  static Future<void> load({bool force = false}) {
    if (_loaded && !force) return Future.value();
    return _loading ??= _fetch().whenComplete(() => _loading = null);
  }

  static Future<void> _fetch() async {
    final data = await HttpApiService().getMyShop();
    if (data == null) return;
    packs.value = ((data['packs'] as List?) ?? const [])
        .whereType<Map>()
        .map((p) => ShopPack.fromJson(Map<String, dynamic>.from(p)))
        .where((p) => p.stickers.isNotEmpty)
        .toList();
    final abilities = data['abilities'];
    if (abilities is Map) canSendGif.value = abilities['gifSend'] != false;
    _loaded = true;
  }
}
