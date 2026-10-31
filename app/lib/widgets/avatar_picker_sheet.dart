import 'package:flutter/material.dart';
import '../core/avatar_catalog.dart';
import '../models/models.dart';
import '../services/app_state_repository.dart';
import 'app_toast.dart';
import 'nopa_dialog_container.dart';

/// Lets the user pick gender and (students) one of the bundled profile pictures.
/// Mentors only choose gender: their picture is the fixed mentor default of that gender.
Future<void> showAvatarPicker(BuildContext context) {
  return showDialog<void>(
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
  late String? _gender = repo.currentUser.gender;
  late String? _selected = AvatarCatalog.isBundled(repo.currentUser.avatarUrl)
      ? repo.currentUser.avatarUrl!.substring(AvatarCatalog.prefix.length)
      : null;
  bool _saving = false;

  bool get _isMentor => repo.currentUser.role == UserRole.mentor || repo.currentUser.role == UserRole.superMentor;

  Future<void> _save() async {
    final gender = _gender;
    if (gender == null) return;
    setState(() => _saving = true);
    final ok = await repo.updateAvatar(gender: gender, avatarKey: _isMentor ? null : _selected);
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
    final canSave = _gender != null && (_isMentor || _selected != null) && !_saving;
    final options = _gender == null ? const <String>[] : AvatarCatalog.optionsFor(_gender);
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
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _genderChip('پسر', 'male')),
                const SizedBox(width: 10),
                Expanded(child: _genderChip('دختر', 'female')),
              ],
            ),
            const SizedBox(height: 16),
            if (_isMentor && _gender != null)
              Center(
                child: CircleAvatar(
                  radius: 44,
                  backgroundImage: AssetImage(AvatarCatalog.mentorDefault(_gender)!),
                ),
              )
            else if (!_isMentor && _gender != null)
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 12,
                runSpacing: 12,
                children: [for (final key in options) _avatarTile(key)],
              ),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: canSave ? _save : null,
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

  Widget _genderChip(String label, String value) {
    final on = _gender == value;
    return GestureDetector(
      onTap: () => setState(() {
        if (_gender != value) _selected = null;
        _gender = value;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: on ? const Color(0xFFE5B585) : Colors.white.withValues(alpha: 0.08),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'YekanBakh',
            fontWeight: FontWeight.bold,
            color: on ? const Color(0xFF332014) : Colors.white,
          ),
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
