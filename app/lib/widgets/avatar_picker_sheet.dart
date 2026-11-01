import 'package:flutter/material.dart';
import '../core/avatar_catalog.dart';
import '../models/models.dart';
import '../services/app_state_repository.dart';
import 'app_toast.dart';
import 'nopa_dialog_container.dart';

/// Lets a student pick one of the bundled profile pictures of the gender set in the admin panel.
/// Mentors cannot choose: their picture is the fixed mentor picture of their gender.
Future<void> showAvatarPicker(BuildContext context) async {
  final user = AppRepository().currentUser;
  final isMentor = user.role == UserRole.mentor || user.role == UserRole.superMentor;
  if (isMentor) {
    AppToast.info(context, 'تصویر راهبر بر اساس جنسیت تعیین می‌شود.');
    return;
  }
  if (user.gender != 'male' && user.gender != 'female') {
    AppToast.info(context, 'جنسیت شما هنوز توسط مدیریت ثبت نشده است.');
    return;
  }
  await showDialog<void>(
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
    setState(() => _saving = true);
    final ok = await repo.updateAvatar(avatarKey: key);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop();
    } else {
      setState(() => _saving = false);
      AppToast.error(context, 'ذخیره تصویر انجام نشد. اتصال اینترنت را بررسی کنید.');
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
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'YekanBakh'),
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
