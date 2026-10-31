import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../services/api_service.dart';
import 'nopa_dialog_container.dart';

class SupportMessageDialog extends StatefulWidget {
  final String? initialSubject;

  const SupportMessageDialog({super.key, this.initialSubject});

  static Future<void> show(BuildContext context, {String? initialSubject}) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => SupportMessageDialog(initialSubject: initialSubject),
    );
  }

  @override
  State<SupportMessageDialog> createState() => _SupportMessageDialogState();
}

class _SupportMessageDialogState extends State<SupportMessageDialog> {
  late final TextEditingController _subjectCtrl;
  final TextEditingController _descCtrl = TextEditingController();
  bool _isSubmitting = false;
  late final String _currentDateStr;

  @override
  void initState() {
    super.initState();
    _subjectCtrl = TextEditingController(text: widget.initialSubject ?? '');
    final now = Jalali.now();
    final y = now.year.toString().padLeft(4, '0');
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    _currentDateStr = '$y/$m/$d'.toPersianDigits();
  }

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    final subject = _subjectCtrl.text.trim();
    final text = _descCtrl.text.trim();

    if (subject.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('لطفاً موضوع پیام را وارد کنید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('لطفاً شرح درخواست خود را بنویسید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final api = HttpApiService();
      await api.createTicket(
        category: 'پیام به پشتیبانی',
        subject: '$subject: $text',
      );

      if (!mounted) return;
      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('درخواست شما با موفقیت برای پشتیبانی ارسال شد ✅', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('خطا در ارسال درخواست: $e', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
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
                // Header Row: Profile / Support Icon on top right in RTL & Centered Title
                Stack(
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF3F3765).withValues(alpha: 0.6),
                          border: Border.all(
                            color: AppColors.buttonCamel.withValues(alpha: 0.85),
                            width: 1.2,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(
                          Icons.person_outline_rounded,
                          color: AppColors.buttonCamel,
                          size: 22,
                        ),
                      ),
                    ),
                    const Text(
                      'پیام به پشتیبانی',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Row 1: موضوع: + Editable Input Box
                _buildDialogRow(
                  label: 'موضوع:',
                  content: Container(
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.all(AppColors.borderWidth),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      alignment: Alignment.center,
                      child: TextField(
                        controller: _subjectCtrl,
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          fontFamily: AppTheme.fontFamily,
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          hintText: 'موضوع پیام را بنویسید...',
                          hintStyle: TextStyle(
                            color: Colors.white.withValues(alpha: 0.25),
                            fontSize: 12,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Row 2: تاریخ: + Current Day Box
                _buildDialogRow(
                  label: 'تاریخ:',
                  content: Container(
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.all(AppColors.borderWidth),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        _currentDateStr,
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Row 3: شرح دهید: + Multi-line Text Field Box
                _buildDialogRow(
                  label: 'شرح دهید:',
                  crossAxisAlignment: CrossAxisAlignment.start,
                  content: Container(
                    height: 110,
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.all(AppColors.borderWidth),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: TextField(
                        controller: _descCtrl,
                        maxLines: 4,
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 12.5,
                          fontFamily: AppTheme.fontFamily,
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          hintText: 'ما را در جریان قرار دهید',
                          hintStyle: TextStyle(
                            color: Colors.white.withValues(alpha: 0.25),
                            fontSize: 12,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Bottom Actions: ارسال (Right in RTL - Camel) & لغو (Left in RTL - Purple)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // ارسال on Right in RTL
                    _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.buttonCamel,
                            ),
                          )
                        : TextButton(
                            onPressed: _submitRequest,
                            child: const Text(
                              'ارسال',
                              style: TextStyle(
                                color: AppColors.buttonCamel,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ),

                    // لغو on Left in RTL
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text(
                        'لغو',
                        style: TextStyle(
                          color: AppColors.buttonCancelPurple,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
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

  Widget _buildDialogRow({
    required String label,
    required Widget content,
    CrossAxisAlignment crossAxisAlignment = CrossAxisAlignment.center,
  }) {
    return Row(
      crossAxisAlignment: crossAxisAlignment,
      children: [
        SizedBox(
          width: 70,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFFB5B0D8),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(child: content),
      ],
    );
  }
}
