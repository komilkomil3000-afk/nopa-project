import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_typography.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import '../core/avatar_catalog.dart';
import '../models/models.dart';
import '../services/app_state_repository.dart';
import 'app_toast.dart';
import 'nopa_dialog_container.dart';

/// Lets a student pick one of the bundled profile pictures of the gender set in the admin panel.
/// Mentors cannot choose: their picture is the fixed mentor picture of their gender.
Future<void> showAvatarPicker(BuildContext context) async {
  final user = AppRepository().currentUser;
  final isMentor = user.role.isMentorLike;
  if (isMentor) {
    AppToast.info(context, 'تصویر راهبر بر اساس جنسیت تعیین می‌شود.');
    return;
  }
  if (user.gender != 'male' && user.gender != 'female') {
    AppToast.info(context, 'جنسیت شما هنوز توسط مدیریت ثبت نشده است.');
    return;
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
  late final List<String> _options = AvatarCatalog.optionsFor(repo.currentUser.gender);
  late String? _selected = AvatarCatalog.isBundled(repo.currentUser.avatarUrl)
      ? repo.currentUser.avatarUrl!.substring(AvatarCatalog.prefix.length)
      : null;
  bool _saving = false;

  Future<void> _save() async {
    final key = _selected;
    if (key == null) return;
    final previousUrl = repo.currentUser.avatarUrl;
    final previousKey = AvatarCatalog.isBundled(previousUrl) ? previousUrl!.substring(AvatarCatalog.prefix.length) : null;
    if (key == previousKey) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _saving = true);
    final ok = await repo.updateAvatar(avatarKey: key);
    if (!mounted) return;
    if (ok) {
      // «لغو» puts the previous bundled picture back (one from outside the set cannot be chosen again here)
      if (previousKey != null) {
        final rootContext = Navigator.of(context).context;
        AppToast.undoable(
          context,
          'تصویر پروفایل تغییر کرد.',
          commit: () async => null,
          onUndo: () async {
            final restored = await repo.updateAvatar(avatarKey: previousKey);
            if (!restored && rootContext.mounted) AppToast.error(rootContext, 'برگرداندن تصویر قبلی انجام نشد.');
          },
        );
      }
      Navigator.of(context).pop();
    } else {
      setState(() => _saving = false);
      AppToast.error(context, 'ذخیره تصویر انجام نشد. اتصال اینترنت را بررسی کنید. اگر فیلترشکن شما روشن است، لطفاً آن را خاموش کنید.');
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
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 12,
              children: [for (final key in _options) _avatarTile(key)],
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

  Widget _avatarTile(String key) {
    final on = _selected == key;
    return GestureDetector(
      onTap: () => setState(() => _selected = key),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: on ? const Color(0xFFE5B585) : Colors.transparent, width: 3),
        ),
        child: CircleAvatar(radius: 34, backgroundImage: AssetImage(AvatarCatalog.assetPath(key))),
      ),
    );
  }
}
