import 'package:cached_network_image/cached_network_image.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_typography.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import '../core/avatar_catalog.dart';
import '../core/constants/api_constants.dart';
import '../models/models.dart';
import '../services/app_state_repository.dart';
import 'app_toast.dart';
import 'nopa_dialog_container.dart';

/// Lets a user pick one of the profile pictures the panel offers for their gender (set in the admin panel).
/// Mentors pick from the mentor pictures of their gender; with only one there is nothing to choose.
Future<void> showAvatarPicker(BuildContext context) async {
  final user = AppRepository().currentUser;
  final isMentor = user.role.isMentorLike;
  if (user.gender != 'male' && user.gender != 'female') {
    AppToast.info(context, 'جنسیت شما هنوز توسط مدیریت ثبت نشده است.');
    return;
  }
  if (isMentor && AvatarCatalog.optionsFor(user.gender, mentor: true).length < 2) {
    // the list may have grown since the app started
    await AppRepository().refreshAppImages();
    if (!context.mounted) return;
    if (AvatarCatalog.optionsFor(user.gender, mentor: true).length < 2) {
      AppToast.info(context, 'تصویر راهبر بر اساس جنسیت تعیین می‌شود.');
      return;
    }
  }
  await showNopaDialog<void>(
    context: context,
    builder: (_) => const Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: _AvatarPickerBody(),
    ),
  );
}

class _AvatarPickerBody extends StatefulWidget {
  const _AvatarPickerBody();

  @override
  State<_AvatarPickerBody> createState() => _AvatarPickerBodyState();
}

class _AvatarPickerBodyState extends State<_AvatarPickerBody> {
  final repo = AppRepository();
  late final bool _mentor = repo.currentUser.role.isMentorLike;
  late List<String> _options = AvatarCatalog.optionsFor(repo.currentUser.gender, mentor: _mentor);
  late String? _selected = _options.contains(repo.currentUser.avatarUrl) ? repo.currentUser.avatarUrl : null;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    // the panel may have changed the list since the app started
    repo.refreshAppImages().then((ok) {
      if (!ok || !mounted) return;
      setState(() {
        _options = AvatarCatalog.optionsFor(repo.currentUser.gender, mentor: _mentor);
        if (_selected != null && !_options.contains(_selected)) _selected = null;
        _selected ??= _options.contains(repo.currentUser.avatarUrl) ? repo.currentUser.avatarUrl : null;
      });
    });
  }

  Future<void> _save() async {
    final value = _selected;
    if (value == null) return;
    final previous = repo.currentUser.avatarUrl;
    if (value == previous) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _saving = true);
    final error = await repo.updateAvatar(avatarUrl: value);
    if (!mounted) return;
    if (error == null) {
      // «لغو» puts the previous picture back while it is still offered (a retired one cannot be chosen again)
      if (previous != null && _options.contains(previous)) {
        final rootContext = Navigator.of(context).context;
        AppToast.undoable(
          context,
          'تصویر پروفایل تغییر کرد.',
          commit: () async => null,
          onUndo: () async {
            final failed = await repo.updateAvatar(avatarUrl: previous);
            if (failed != null && rootContext.mounted) AppToast.error(rootContext, 'برگرداندن تصویر قبلی انجام نشد.');
          },
        );
      }
      Navigator.of(context).pop();
    } else {
      setState(() => _saving = false);
      AppToast.error(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return NopaDialogContainer(
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'انتخاب تصویر پروفایل',
              textAlign: TextAlign.center,
              style: AppTypography.h2,
            ),
            const SizedBox(height: 16),
            Flexible(
              child: SingleChildScrollView(
                child: Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 12,
                  runSpacing: 12,
                  children: [for (final value in _options) _avatarTile(value)],
                ),
              ),
            ),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: (_selected != null && !_saving) ? _save : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE5B585),
                foregroundColor: const Color(0xFF332014),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('ذخیره', style: TextStyle(fontFamily: 'YekanBakh', fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  ImageProvider? _imageOf(String value) {
    final asset = AvatarCatalog.assetFor(value);
    if (asset != null) return AssetImage(asset);
    final url = ApiConstants.resolveImageUrl(value);
    return url.startsWith('http') ? CachedNetworkImageProvider(url, maxWidth: 220) : null;
  }

  Widget _avatarTile(String value) {
    final on = _selected == value;
    return GestureDetector(
      onTap: () => setState(() => _selected = value),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: on ? const Color(0xFFE5B585) : Colors.transparent, width: 3),
        ),
        child: CircleAvatar(
          radius: 34,
          backgroundColor: Colors.indigo.shade800,
          backgroundImage: _imageOf(value),
        ),
      ),
    );
  }
}
