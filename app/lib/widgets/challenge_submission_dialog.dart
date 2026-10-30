import 'dart:io' as io;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/nopa_dialog_container.dart';

/// What the dialog hands back when the answer was saved on the server.
class ChallengeSubmissionResult {
  final String answerText;
  final bool isQuiz;
  const ChallengeSubmissionResult({required this.answerText, required this.isQuiz});
}

/// Answer dialog for a challenge.
///
/// - 'new' / 'rejected': editable (a rejected answer is corrected and sent again).
/// - 'pending' / 'completed' / 'expired': view only. While the mentor has not replied the
///   answer can neither be edited nor sent again, but the student can still see it
///   (including a preview of the file they attached).
class ChallengeSubmissionDialog extends StatefulWidget {
  final Map<String, dynamic> challenge;
  final String status;

  const ChallengeSubmissionDialog({super.key, required this.challenge, required this.status});

  static Future<ChallengeSubmissionResult?> show(
    BuildContext context, {
    required Map<String, dynamic> challenge,
    required String status,
  }) {
    return showDialog<ChallengeSubmissionResult>(
      context: context,
      barrierDismissible: false,
      builder: (_) => ChallengeSubmissionDialog(challenge: challenge, status: status),
    );
  }

  @override
  State<ChallengeSubmissionDialog> createState() => _ChallengeSubmissionDialogState();
}

class _ChallengeSubmissionDialogState extends State<ChallengeSubmissionDialog> {
  static const _imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'];
  // The submit flow appends "\nفایل: <name>" to the typed answer; it is shown as a file tile instead.
  static const _fileMarker = '\nفایل: ';

  late final TextEditingController _textCtrl;
  // Quiz: one entry per question; _answers[i] is the chosen option (-1 = unanswered).
  int _step = 0;
  late final List<int> _answers;
  bool _sending = false;
  String? _pickedName;
  io.File? _pickedFile;

  late final bool _isQuiz;
  late final List<({String text, List<String> options})> _questions;
  late final String? _existingFileUrl;
  late final String _existingFileName;

  ({String text, List<String> options}) get _currentQuestion => _questions[_step];

  bool get _readOnly => widget.status != 'new' && widget.status != 'rejected';

  @override
  void initState() {
    super.initState();
    final c = widget.challenge;
    final String type = c['type']?.toString().toLowerCase() ?? '';
    final List<dynamic> qList = c['questions'] is List ? (c['questions'] as List) : [];
    _isQuiz = type == 'quiz' || type == 'step_by_step_quiz' || type == 'multiple_choice' || qList.isNotEmpty;

    final fallbackText = c['desc']?.toString() ?? '';
    final questions = <({String text, List<String> options})>[];
    for (final raw in qList) {
      if (raw is! Map) continue;
      final rawOpts = raw['options'] ?? raw['opts'];
      var options = rawOpts is List ? rawOpts.map((e) => e.toString()).toList() : <String>[];
      if (options.isEmpty && _isQuiz) {
        options = ['پاسخ شماره اول', 'پاسخ شماره دوم', 'پاسخ شماره سوم', 'پاسخ شماره چهارم'];
      }
      questions.add((
        text: (raw['q'] ?? raw['question'] ?? raw['text'] ?? fallbackText).toString(),
        options: options,
      ));
    }
    if (questions.isEmpty) {
      questions.add((
        text: fallbackText,
        options: _isQuiz ? ['پاسخ شماره اول', 'پاسخ شماره دوم', 'پاسخ شماره سوم', 'پاسخ شماره چهارم'] : <String>[],
      ));
    }
    _questions = questions;
    _answers = List<int>.filled(questions.length, -1);

    String answer = c['myAnswerText']?.toString() ?? '';
    final markerAt = answer.lastIndexOf(_fileMarker);
    String fileName = '';
    if (markerAt >= 0) {
      fileName = answer.substring(markerAt + _fileMarker.length).trim();
      answer = answer.substring(0, markerAt);
    }
    _textCtrl = TextEditingController(text: answer);

    final rawUrl = c['myFileUrl']?.toString() ?? '';
    _existingFileUrl = rawUrl.isNotEmpty ? ApiConstants.resolveImageUrl(rawUrl) : null;
    _existingFileName = fileName.isNotEmpty
        ? fileName
        : (rawUrl.isNotEmpty ? Uri.tryParse(rawUrl)?.pathSegments.lastOrNull ?? 'فایل پیوست' : '');
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  bool _isImageName(String? name) {
    if (name == null) return false;
    final dot = name.lastIndexOf('.');
    if (dot < 0) return false;
    return _imageExts.contains(name.substring(dot + 1).toLowerCase().split('?').first);
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.any, allowMultiple: false);
      if (result != null && result.files.isNotEmpty) {
        final f = result.files.first;
        setState(() {
          _pickedName = f.name;
          _pickedFile = f.path != null ? io.File(f.path!) : null;
        });
      }
    } catch (e) {
      debugPrint('FilePicker error: $e');
    }
  }

  Future<void> _openUrl(String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication).catchError((_) => false);
    if (!ok && mounted) AppToast.error(context, 'امکان باز کردن فایل وجود ندارد.');
  }

  void _showFullImage(ImageProvider image) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            InteractiveViewer(child: Center(child: Image(image: image, fit: BoxFit.contain))),
            Positioned(
              top: 4,
              left: 4,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_sending) return;
    final api = HttpApiService();
    final id = widget.challenge['id']?.toString() ?? '';

    if (_isQuiz) {
      final firstMissing = _answers.indexOf(-1);
      if (firstMissing != -1) {
        setState(() => _step = firstMissing);
        AppToast.error(context, 'لطفاً به همه‌ی سوال‌ها پاسخ دهید.');
        return;
      }
      setState(() => _sending = true);
      final res = await api.submitQuizChallengeWithError(id, _answers);
      if (!mounted) return;
      if (res.result == null) {
        setState(() => _sending = false);
        AppToast.error(context, res.error ?? 'ثبت پاسخ با خطا مواجه شد. دوباره تلاش کنید.');
        return;
      }
      Navigator.pop(
        context,
        ChallengeSubmissionResult(
          answerText: _questions.length == 1
              ? 'گزینه انتخابی: ${_answers[0] + 1}'
              : 'گزینه‌های انتخابی: ${_answers.map((a) => a + 1).join('، ')}',
          isQuiz: true,
        ),
      );
      return;
    }

    final text = _textCtrl.text.trim();
    final hasFile = _pickedFile != null || _existingFileUrl != null;
    if (text.isEmpty && !hasFile) {
      AppToast.error(context, 'لطفاً متن پاسخ یا فایل را وارد نمایید.');
      return;
    }

    setState(() => _sending = true);
    String? fileUrl;
    if (_pickedFile != null) {
      final upload = await api.uploadMediaFile(
        _pickedFile!,
        assetType: 'challenge_submission',
        title: widget.challenge['title']?.toString(),
      );
      fileUrl = upload?['url']?.toString() ?? upload?['media']?['url']?.toString();
      if (fileUrl == null || fileUrl.isEmpty) {
        if (!mounted) return;
        setState(() => _sending = false);
        AppToast.error(context, 'بارگذاری فایل ناموفق بود. دوباره تلاش کنید.');
        return;
      }
    }

    final fileName = _pickedName ?? (_existingFileUrl != null ? _existingFileName : null);
    final answer = (fileName != null && fileName.isNotEmpty) ? '$text$_fileMarker$fileName' : text;
    final error = await api.submitTaskWithError(id, answer, fileUrl: fileUrl);
    if (!mounted) return;
    if (error != null) {
      setState(() => _sending = false);
      AppToast.error(context, error);
      return;
    }
    Navigator.pop(context, ChallengeSubmissionResult(answerText: answer, isQuiz: false));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_sending,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: NopaDialogContainer(
            maxWidth: 420,
            radius: 24,
            padding: const EdgeInsets.all(22),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildHeader(),
                  const SizedBox(height: 18),
                  _labeledRow('تیتر:', widget.challenge['title']?.toString() ?? '', 13, FontWeight.w600),
                  const SizedBox(height: 14),
                  _labeledRow(
                    _isQuiz ? 'سوال${(_step + 1).toString().toPersianDigits()}:' : 'سوال:',
                    _currentQuestion.text.isNotEmpty ? _currentQuestion.text : 'توضیحات تکمیلی این چالش',
                    12.5,
                    FontWeight.w500,
                    height: 1.5,
                  ),
                  const SizedBox(height: 14),
                  _buildStatusBanner(),
                  if (_isQuiz) ..._buildQuizBody() else ..._buildTextBody(),
                  const SizedBox(height: 22),
                  _buildActions(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: const Color(0xFF7E72B8).withValues(alpha: 0.35),
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: Icon(Icons.local_fire_department_rounded, color: Color(0xFF9E92E8), size: 22),
          ),
        ),
        Expanded(
          child: Center(
            child: Text(
              _readOnly ? 'پاسخ من' : (widget.status == 'rejected' ? 'اصلاح پاسخ' : 'شرکت در چالش'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(width: 36),
      ],
    );
  }

  Widget _labeledRow(String label, String value, double size, FontWeight weight, {double? height}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _pill(label),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              color: const Color(0xFFD6D3E6),
              fontSize: size,
              height: height,
              fontWeight: weight,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),
      ],
    );
  }

  Widget _pill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF383562),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF535084), width: 1.0),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFFD6D3E6),
          fontSize: 11,
          fontWeight: FontWeight.bold,
          fontFamily: AppTheme.fontFamily,
        ),
      ),
    );
  }

  Widget _buildStatusBanner() {
    final feedback = widget.challenge['mentorFeedback']?.toString().trim() ?? '';
    String? text;
    Color color;
    IconData icon;
    switch (widget.status) {
      case 'pending':
        text = 'پاسخ شما ارسال شد و در انتظار بررسی راهبر است. تا اعلام نتیجه امکان ویرایش یا ارسال مجدد وجود ندارد.';
        color = const Color(0xFF38BDF8);
        icon = Icons.hourglass_top_rounded;
        break;
      case 'rejected':
        text = feedback.isNotEmpty
            ? 'راهبر نیاز به اصلاح دارد: $feedback'
            : 'راهبر نیاز به اصلاح دارد. پاسخ را اصلاح و دوباره ارسال کنید.';
        color = const Color(0xFFEF4444);
        icon = Icons.error_outline_rounded;
        break;
      case 'completed':
        text = feedback.isNotEmpty ? 'پاسخ شما تأیید شد. توضیح راهبر: $feedback' : 'پاسخ شما تأیید شد.';
        color = const Color(0xFF10B981);
        icon = Icons.check_circle_outline_rounded;
        break;
      case 'expired':
        text = 'مهلت این چالش به پایان رسیده است.';
        color = const Color(0xFF9D99B8);
        icon = Icons.timer_off_outlined;
        break;
      default:
        return const SizedBox.shrink();
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 17),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: color,
                fontSize: 11.5,
                height: 1.5,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildQuizBody() {
    if (_readOnly) {
      final answer = widget.challenge['myAnswerText']?.toString() ?? '';
      if (answer.isEmpty) return [];
      return [_labeledRow('پاسخ:', answer, 12.5, FontWeight.w500)];
    }
    final options = _currentQuestion.options;
    final tiles = List.generate(options.length, (index) {
      final bool isSelected = _answers[_step] == index;
      return Padding(
        padding: const EdgeInsets.only(bottom: 10.0),
        child: GestureDetector(
          onTap: _sending ? null : () => setState(() => _answers[_step] = index),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFF383568) : const Color(0xFF1E1D38),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected ? const Color(0xFF9292E2) : const Color(0xFF454270),
                width: isSelected ? 1.4 : 1.0,
              ),
            ),
            child: Row(
              children: [
                Text(
                  (index + 1).toString().toPersianDigits(),
                  style: TextStyle(
                    color: isSelected ? const Color(0xFFDE9959) : const Color(0xFF8E88B0),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    options[index],
                    style: TextStyle(
                      color: isSelected ? Colors.white : const Color(0xFFD3D0E3),
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    });
    return [
      ...tiles,
      if (_questions.length > 1) _buildStepper(),
    ];
  }

  Widget _buildStepper() {
    final last = _step == _questions.length - 1;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        TextButton(
          onPressed: _step == 0 || _sending ? null : () => setState(() => _step--),
          child: const Text('قبلی'),
        ),
        Text(
          'سوال ${(_step + 1).toString().toPersianDigits()} از ${_questions.length.toString().toPersianDigits()}',
          style: const TextStyle(
            color: Color(0xFF9E92E8),
            fontSize: 12,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.fontFamily,
          ),
        ),
        TextButton(
          onPressed: last || _sending ? null : () => setState(() => _step++),
          child: const Text('بعدی'),
        ),
      ],
    );
  }

  List<Widget> _buildTextBody() {
    final bool hasPicked = _pickedName != null;
    final bool hasExisting = _existingFileUrl != null;
    return [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _pill('پاسخ:'),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _textCtrl,
              readOnly: _readOnly,
              maxLines: 4,
              style: const TextStyle(color: Colors.white, fontSize: 12.5, fontFamily: AppTheme.fontFamily),
              textAlign: TextAlign.right,
              decoration: InputDecoration(
                hintText: _readOnly ? 'پاسخ متنی ثبت نشده است' : 'پاسخ تشریحی خود را بنویسید...',
                hintStyle: const TextStyle(color: Color(0xFF7E789F), fontSize: 11.5, fontFamily: AppTheme.fontFamily),
                filled: true,
                fillColor: const Color(0xFF1E1D38),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF454270)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF454270)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: _readOnly ? const Color(0xFF454270) : const Color(0xFF9292E2)),
                ),
              ),
            ),
          ),
        ],
      ),
      if (hasPicked || hasExisting) ...[
        const SizedBox(height: 14),
        _buildFilePreview(),
      ],
      if (!_readOnly) ...[
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _pill('پیوست فایل:'),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: _sending ? null : _pickFile,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1D38),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF454270)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          hasPicked
                              ? _pickedName!
                              : (hasExisting ? 'جایگزینی فایل قبلی' : 'انتخاب فایل از دستگاه'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: hasPicked ? const Color(0xFF22C55E) : const Color(0xFF7E789F),
                            fontSize: 11.5,
                            fontWeight: hasPicked ? FontWeight.bold : FontWeight.normal,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),
                      Icon(
                        hasPicked ? Icons.check_circle_outline : Icons.attach_file,
                        color: hasPicked ? const Color(0xFF22C55E) : const Color(0xFF7E789F),
                        size: 16,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    ];
  }

  /// Preview of the attached file: the newly picked one, else the one already sent.
  Widget _buildFilePreview() {
    final bool picked = _pickedName != null;
    final String name = picked ? _pickedName! : _existingFileName;
    final bool isImage = _isImageName(name) || (!picked && _isImageName(_existingFileUrl));

    Widget tile() => Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1D38),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF454270)),
          ),
          child: Row(
            children: [
              const Icon(Icons.insert_drive_file_outlined, color: Color(0xFF9E92E8), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  name.isNotEmpty ? name : 'فایل پیوست',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Color(0xFFD6D3E6), fontSize: 12, fontFamily: AppTheme.fontFamily),
                ),
              ),
              if (!picked && _existingFileUrl != null)
                GestureDetector(
                  onTap: () => _openUrl(_existingFileUrl),
                  child: const Text(
                    'باز کردن',
                    style: TextStyle(
                      color: AppColors.buttonCamel,
                      fontSize: 11.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ),
            ],
          ),
        );

    if (!isImage) return tile();

    final ImageProvider? provider = picked
        ? (_pickedFile != null ? FileImage(_pickedFile!) : null)
        : CachedNetworkImageProvider(_existingFileUrl!);
    if (provider == null) return tile();

    return GestureDetector(
      onTap: () => _showFullImage(provider),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(maxHeight: 180),
          color: const Color(0xFF1E1D38),
          child: Image(
            image: provider,
            width: double.infinity,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => tile(),
          ),
        ),
      ),
    );
  }

  Widget _buildActions() {
    final close = TextButton(
      onPressed: _sending ? null : () => Navigator.pop(context),
      child: Text(
        _readOnly ? 'بستن' : 'لغو',
        style: const TextStyle(
          color: AppColors.buttonCancelPurple,
          fontSize: 14,
          fontWeight: FontWeight.w600,
          fontFamily: AppTheme.fontFamily,
        ),
      ),
    );
    if (_readOnly) return Center(child: close);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        TextButton(
          onPressed: _sending ? null : _submit,
          child: _sending
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.buttonCamel),
                )
              : Text(
                  widget.status == 'rejected' ? 'ارسال مجدد' : 'ارسال',
                  style: const TextStyle(
                    color: AppColors.buttonCamel,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
        ),
        close,
      ],
    );
  }
}
