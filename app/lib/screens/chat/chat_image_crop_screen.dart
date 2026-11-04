import 'package:crop_your_image/crop_your_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:image/image.dart' as img;
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart' show ChatButton;
import 'package:nopa_app/widgets/fa_text.dart';

/// Opens a picked photo whole and lets the person choose the square part of it to keep
/// (move and resize the frame over the photo), so the picture is never squeezed out of shape.
/// Returns the chosen part as JPEG bytes (at most 1024 px a side), or null when cancelled.
Future<Uint8List?> cropImageSquare(BuildContext context, Uint8List original, {String title = 'انتخاب بخشی از عکس'}) {
  return Navigator.of(context).push<Uint8List>(
    MaterialPageRoute(fullscreenDialog: true, builder: (_) => _ChatImageCropScreen(image: original, title: title)),
  );
}

class _ChatImageCropScreen extends StatefulWidget {
  final Uint8List image;
  final String title;
  const _ChatImageCropScreen({required this.image, required this.title});

  @override
  State<_ChatImageCropScreen> createState() => _ChatImageCropScreenState();
}

class _ChatImageCropScreenState extends State<_ChatImageCropScreen> {
  final CropController _controller = CropController();
  bool _working = false;

  /// Pure Dart (no native plugin): fit within 1024 px and re-encode as JPEG.
  static Uint8List _compact(Uint8List cropped) {
    final decoded = img.decodeImage(cropped);
    if (decoded == null) return cropped;
    final resized = decoded.width > 1024 ? img.copyResize(decoded, width: 1024) : decoded;
    return Uint8List.fromList(img.encodeJpg(resized, quality: 88));
  }

  Future<void> _onCropped(CropResult result) async {
    switch (result) {
      case CropSuccess(:final croppedImage):
        final bytes = await compute(_compact, croppedImage);
        if (mounted) Navigator.of(context).pop(bytes);
      case CropFailure():
        if (mounted) {
          setState(() => _working = false);
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('برش عکس انجام نشد.')));
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          elevation: 0,
          title: Text(widget.title, style: const TextStyle(color: Colors.white, fontSize: 15)),
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: Crop(
                  image: widget.image,
                  controller: _controller,
                  aspectRatio: 1,
                  withCircleUi: true,
                  baseColor: Colors.black,
                  maskColor: Colors.black.withValues(alpha: 0.6),
                  progressIndicator: const CircularProgressIndicator(),
                  onCropped: _onCropped,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                child: Column(
                  children: [
                    Text('قاب را جابه‌جا کنید و گوشه‌هایش را بکشید تا بخش دلخواه انتخاب شود.', style: ChatTheme.caption.copyWith(color: Colors.white70), textAlign: TextAlign.center),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ChatButton(label: 'انصراف', primary: false, onPressed: _working ? null : () => Navigator.of(context).pop()),
                        const SizedBox(width: 12),
                        ChatButton(
                          label: _working ? 'در حال برش...' : 'تایید',
                          onPressed: _working
                              ? null
                              : () {
                                  setState(() => _working = true);
                                  // The square itself (not the circle's cut-out): it shows as a circle or a square elsewhere
                                  _controller.crop();
                                },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
