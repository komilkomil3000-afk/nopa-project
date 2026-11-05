import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/nopa_dialog_container.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:nopa_app/widgets/tap_expander.dart';

/// The «ایجاد / تغییر رمز عبور ثابت» block of the profile editors (student and mentor): a header and one button
/// that opens [PasswordChangeDialog]. Both roles share it so the password is changed the same way for everyone.
class PasswordChangeSection extends StatelessWidget {
  final String phoneNumber;
  const PasswordChangeSection({super.key, required this.phoneNumber});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Row(
            children: [
              Text('ایجاد / تغییر رمز عبور ثابت', style: AppTypography.h3.copyWith(color: AppColors.buttonCamel)),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [AppColors.buttonCamel.withValues(alpha: 0.5), Colors.transparent]),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        TapExpander(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => showNopaDialog(
              context: context,
              barrierDismissible: true,
              builder: (_) => PasswordChangeDialog(phoneNumber: phoneNumber),
            ),
            child: Container(
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFF1B192A),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.buttonCamel, width: 1.0),
              ),
              child: Text('تغییر رمز عبور', style: AppTypography.h3.copyWith(color: AppColors.accentGoldEnd)),
            ),
          ),
        ),
      ],
    );
  }
}

/// Modal for changing the fixed password.
/// Remembers the old one: old password -> confirm -> new password twice.
/// Forgot it: SMS code -> new password twice.
class PasswordChangeDialog extends StatefulWidget {
  final String phoneNumber;
  const PasswordChangeDialog({super.key, required this.phoneNumber});

  @override
  State<PasswordChangeDialog> createState() => _PasswordChangeDialogState();
}

enum _PwStep { choose, oldPassword, smsCode, newPassword }

class _PasswordChangeDialogState extends State<PasswordChangeDialog> {
  _PwStep _step = _PwStep.choose;
  bool _forgot = false;
  bool _busy = false;
  String? _error;

  final _oldCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _repeatCtrl = TextEditingController();
  bool _showOld = false;
  bool _showNew = false;
  bool _showRepeat = false;

  @override
  void dispose() {
    _oldCtrl.dispose();
    _codeCtrl.dispose();
    _newCtrl.dispose();
    _repeatCtrl.dispose();
    super.dispose();
  }

  void _fail(String msg) => setState(() {
        _busy = false;
        _error = msg;
      });

  Future<void> _sendSms() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await HttpApiService().requestPasswordResetCode(widget.phoneNumber);
    if (!mounted) return;
    if (err != null) return _fail(err);
    setState(() {
      _busy = false;
      _forgot = true;
      _step = _PwStep.smsCode;
    });
  }

  Future<void> _verifyOld() async {
    final old = _oldCtrl.text.trim();
    if (old.isEmpty) return _fail('رمز قبلی را وارد کنید');
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await HttpApiService().verifyCurrentPassword(old);
    if (!mounted) return;
    if (err != null) return _fail(err);
    setState(() {
      _busy = false;
      _step = _PwStep.newPassword;
    });
  }

  void _acceptCode() {
    if (_codeCtrl.text.trim().isEmpty) return _fail('کد ارسال‌شده به پیامک را وارد کنید');
    setState(() {
      _error = null;
      _step = _PwStep.newPassword;
    });
  }

  Future<void> _submitNew() async {
    final pass = _newCtrl.text.trim();
    if (pass.length < 4) return _fail('رمز عبور باید حداقل ۴ کاراکتر باشد');
    if (pass != _repeatCtrl.text.trim()) return _fail('رمز جدید و تکرار آن یکسان نیستند');
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await HttpApiService().setNewPassword(
      pass,
      smsCode: _forgot ? _codeCtrl.text.trim() : null,
      currentPassword: _forgot ? null : _oldCtrl.text.trim(),
    );
    if (!mounted) return;
    if (err != null) {
      // A wrong / expired SMS code is fixed on the code step
      setState(() {
        _busy = false;
        _error = err;
        if (_forgot && err.contains('کد')) _step = _PwStep.smsCode;
      });
      return;
    }
    Navigator.pop(context);
    AppToast.info(context, 'رمز عبور با موفقیت تغییر کرد');
  }

  Widget _field(String label, TextEditingController c,
      {bool obscure = false, VoidCallback? toggle, bool visible = false, TextInputType? keyboard}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, right: 4),
          child: Text(label,
              style: AppTypography.bodyMedium.copyWith(color: Color(0xFF9E9BB8))),
        ),
        Container(
          decoration: BoxDecoration(gradient: AppColors.strokeGradient, borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.all(AppColors.borderWidth),
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            decoration: BoxDecoration(gradient: AppColors.darkSurfaceGradient, borderRadius: BorderRadius.circular(9)),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: c,
                    obscureText: obscure && !visible,
                    keyboardType: keyboard,
                    style: AppTypography.bodyLarge.copyWith(color: Color(0xFFEAE8F8)),
                    decoration: const InputDecoration(isDense: true, border: InputBorder.none),
                  ),
                ),
                if (obscure)
                  TapExpander(
                    child: GestureDetector(
                      onTap: toggle,
                      child: Icon(
                        visible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        color: const Color(0xFF8E889D),
                        size: 18,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _button(String label, VoidCallback? onTap, {bool primary = true}) {
    return TapExpander(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _busy ? null : onTap,
        child: Container(
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF1B192A),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: primary ? AppColors.buttonCamel : const Color(0xFF5A4D80), width: 1.0),
          ),
          child: _busy && primary
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFCD8449)))
              : Text(label,
                  style: AppTypography.h3.copyWith(color: primary ? AppColors.accentGoldEnd : const Color(0xFFB5B0D8))),
        ),
      ),
    );
  }

  List<Widget> _body() {
    switch (_step) {
      case _PwStep.choose:
        return [
          Text('رمز قبلی خود را به یاد دارید؟',
              textAlign: TextAlign.center,
              style: AppTypography.bodyLarge.copyWith(color: Color(0xFFE2E0F0))),
          const SizedBox(height: 16),
          _button('بله، یادم هست', () => setState(() {
                _forgot = false;
                _error = null;
                _step = _PwStep.oldPassword;
              })),
          const SizedBox(height: 10),
          _button('نه، یادم نیست (ارسال پیامک)', _sendSms),
        ];
      case _PwStep.oldPassword:
        return [
          _field('رمز قبلی', _oldCtrl, obscure: true, visible: _showOld, toggle: () => setState(() => _showOld = !_showOld)),
          const SizedBox(height: 14),
          _button('تایید', _verifyOld),
        ];
      case _PwStep.smsCode:
        return [
          Text('کد تایید برای شماره شما پیامک شد',
              style: AppTypography.caption.copyWith(color: Color(0xFF9E9BB8))),
          const SizedBox(height: 10),
          _field('کد پیامک‌شده', _codeCtrl, keyboard: TextInputType.number),
          const SizedBox(height: 6),
          TapExpander(
            child: GestureDetector(
              onTap: _busy ? null : _sendSms,
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                child: Text('ارسال دوباره کد',
                    style: AppTypography.caption.copyWith(color: AppColors.buttonCamel)),
              ),
            ),
          ),
          const SizedBox(height: 10),
          _button('تایید', _acceptCode),
        ];
      case _PwStep.newPassword:
        return [
          _field('رمز جدید', _newCtrl, obscure: true, visible: _showNew, toggle: () => setState(() => _showNew = !_showNew)),
          const SizedBox(height: 12),
          _field('تکرار رمز جدید', _repeatCtrl,
              obscure: true, visible: _showRepeat, toggle: () => setState(() => _showRepeat = !_showRepeat)),
          const SizedBox(height: 14),
          _button('ثبت رمز جدید', _submitNew),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: NopaDialogContainer(
          constraints: const BoxConstraints(maxWidth: 420),
          padding: const EdgeInsets.all(20),
          radius: 20,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('تغییر رمز عبور',
                    textAlign: TextAlign.center,
                    style: AppTypography.h2),
                const SizedBox(height: 18),
                ..._body(),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!,
                      textAlign: TextAlign.center,
                      style: AppTypography.caption.copyWith(color: Color(0xFFFF8A80))),
                ],
                const SizedBox(height: 12),
                _button('انصراف', () => Navigator.pop(context), primary: false),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
