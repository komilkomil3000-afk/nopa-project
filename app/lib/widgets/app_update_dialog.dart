import 'dart:async';
import 'dart:io' show File;

import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/services/app_update_service.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:url_launcher/url_launcher.dart';

/// Shows the new version and updates the app in place: downloads the file of this phone's processor
/// with a progress bar and its size, then hands it to Android's installer («نصب»).
Future<void> showAppUpdateDialog(BuildContext context, AppUpdateInfo info) {
  return showNopaModal<void>(
    context,
    // a running download is cancelled only with its own button, never by a stray tap outside
    barrierDismissible: false,
    builder: (_) => AppUpdateDialog(info: info),
  );
}

enum _Stage { ready, downloading, downloaded, failed }

class AppUpdateDialog extends StatefulWidget {
  const AppUpdateDialog({super.key, required this.info});

  final AppUpdateInfo info;

  @override
  State<AppUpdateDialog> createState() => _AppUpdateDialogState();
}

class _AppUpdateDialogState extends State<AppUpdateDialog> with WidgetsBindingObserver {
  static const _textColor = Color(0xFFD3D0E3);

  late final AppUpdateDownload _download = AppUpdateDownload(widget.info);
  _Stage _stage = _Stage.ready;
  File? _file;
  /// Sent to the system page for "install unknown apps": install as soon as the user comes back allowed.
  bool _waitingPermission = false;
  bool _installing = false;

  bool get _inApp => AppInstaller.supported && widget.info.downloadUrl.isNotEmpty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    AppInstaller.failure.addListener(_onInstallFailure);
    // downloaded before (the dialog was closed with «بعداً»): straight to «نصب»
    if (_inApp) {
      _download.existing().then((f) {
        if (f != null && mounted && _stage == _Stage.ready) setState(() { _file = f; _stage = _Stage.downloaded; });
      });
    }
  }

  void _onInstallFailure() {
    final why = AppInstaller.failure.value;
    if (why == null || !mounted) return;
    AppToast.error(context, why);
    // a broken file is deleted so «تلاش دوباره» downloads it afresh
    if (why.contains('سالم نیست')) {
      try { _file?.deleteSync(); } catch (_) {}
      setState(() { _file = null; _stage = _Stage.ready; });
    }
  }

  @override
  void dispose() {
    AppInstaller.failure.removeListener(_onInstallFailure);
    WidgetsBinding.instance.removeObserver(this);
    if (_stage == _Stage.downloading) _download.cancel();
    _download.progress.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _waitingPermission) {
      _waitingPermission = false;
      AppInstaller.canInstall().then((ok) { if (ok && mounted) _install(); });
    }
  }

  Future<void> _start() async {
    if (!_inApp) return _openInBrowser();
    setState(() => _stage = _Stage.downloading);
    try {
      final file = await _download.start();
      if (!mounted) return;
      setState(() { _file = file; _stage = _Stage.downloaded; });
    } on StateError {
      // cancelled: the dialog is closing
    } catch (_) {
      if (mounted) setState(() => _stage = _Stage.failed);
    }
  }

  void _cancel() {
    _download.cancel();
    Navigator.of(context).pop();
  }

  Future<void> _install() async {
    final file = _file;
    if (file == null || _installing) return;
    setState(() => _installing = true);
    try {
      if (!await AppInstaller.canInstall()) {
        // Android 8+: once per app, "allow from this source"; coming back installs on its own
        if (!mounted) return;
        AppToast.info(context, 'برای نصب، گزینه‌ی «اجازه از این منبع» را برای نپا روشن کنید و برگردید.');
        _waitingPermission = true;
        await AppInstaller.openInstallSettings();
        return;
      }
      final ok = await AppInstaller.install(file);
      if (!mounted) return;
      if (!ok) {
        AppToast.error(context, 'باز کردن نصب‌کننده ممکن نشد. فایل را با مرورگر دانلود کنید.');
      } else {
        AppToast.info(context, 'نصب را در پنجره‌ی اندروید تأیید کنید. پس از نصب، برنامه بسته می‌شود؛ فقط کافی است دوباره بازش کنید.');
      }
    } finally {
      if (mounted) setState(() => _installing = false);
    }
  }

  Future<void> _openInBrowser() async {
    final uri = Uri.tryParse(widget.info.downloadUrl);
    if (uri == null || widget.info.downloadUrl.isEmpty || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) AppToast.error(context, 'لینک دانلود در دسترس نیست.');
      return;
    }
    if (mounted) Navigator.of(context).pop();
  }

  /// "12.4" → "12٫4" (fa Text turns the digits Persian; the decimal mark is set here)
  static String _mb(int bytes) => (bytes / (1024 * 1024)).toStringAsFixed(1).replaceAll('.', '٫');

  TextStyle get _body => AppTypography.bodyMedium.copyWith(color: _textColor);

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    final close = NopaModalAction(label: 'بعداً', variant: NopaModalActionVariant.secondary, onPressed: () => Navigator.of(context).pop());

    // no file for this phone's processor in this release
    if (info.downloadUrl.isEmpty) {
      return NopaModalShell(
        maxWidth: 400,
        headerIcon: Icons.cloud_download_rounded,
        title: 'نسخه‌ی جدید ${info.version}',
        padding: const EdgeInsets.all(22),
        actions: [NopaModalAction(label: 'باشه', onPressed: () => Navigator.of(context).pop())],
        child: Text(
          'فایل این نسخه برای پردازنده‌ی گوشی شما (${info.abi}) هنوز منتشر نشده است. کمی بعد دوباره امتحان کنید.',
          style: _body,
        ),
      );
    }

    late final Widget body;
    late final List<NopaModalAction> actions;
    switch (_stage) {
      case _Stage.ready:
        body = Text(
          info.notes.isEmpty
              ? 'یک نسخه‌ی جدید از نپا منتشر شده است. برای ادامه، برنامه را به‌روزرسانی کنید.'
              : 'تغییرات این نسخه:\n${info.notes.map((n) => '• $n').join('\n')}',
          style: _body,
        );
        actions = [close, NopaModalAction(label: _inApp ? 'دانلود و نصب' : 'دانلود و به‌روزرسانی', onPressed: _start)];
      case _Stage.downloading:
        body = _progress();
        actions = [NopaModalAction(label: 'لغو دانلود', variant: NopaModalActionVariant.secondary, onPressed: _cancel)];
      case _Stage.downloaded:
        final size = _file?.lengthSync() ?? 0;
        body = Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('دانلود تمام شد (${_mb(size)} مگابایت).', style: _body),
            const SizedBox(height: 6),
            Text('برای به‌روزرسانی «نصب» را بزنید؛ اطلاعات و ورود شما سر جایش می‌ماند.', style: _body.copyWith(fontSize: 12.5)),
          ],
        );
        actions = [close, NopaModalAction(label: 'نصب', loading: _installing, onPressed: _installing ? null : _install)];
      case _Stage.failed:
        body = Text(
          'دانلود انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید. اگر فیلترشکن شما روشن است، لطفاً آن را خاموش کنید.',
          style: _body,
        );
        actions = [
          NopaModalAction(label: 'دانلود با مرورگر', variant: NopaModalActionVariant.secondary, onPressed: _openInBrowser),
          NopaModalAction(label: 'تلاش دوباره', onPressed: _start),
        ];
    }

    return PopScope(
      canPop: _stage != _Stage.downloading,
      child: NopaModalShell(
        maxWidth: 400,
        headerIcon: _stage == _Stage.downloaded ? Icons.system_update_rounded : Icons.cloud_download_rounded,
        title: 'نسخه‌ی جدید ${info.version}',
        padding: const EdgeInsets.all(22),
        actions: actions,
        child: body,
      ),
    );
  }

  Widget _progress() {
    return ValueListenableBuilder<({int received, int total})>(
      valueListenable: _download.progress,
      builder: (context, p, _) {
        final known = p.total > 0;
        final ratio = known ? (p.received / p.total).clamp(0.0, 1.0) : null;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text('جهان در حال نوسازی است', style: _body.copyWith(fontWeight: FontWeight.w700)),
                const _Dots(),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 8,
                color: AppColors.buttonCamel,
                backgroundColor: Colors.white.withValues(alpha: 0.10),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  known ? '${_mb(p.received)} از ${_mb(p.total)} مگابایت' : '${_mb(p.received)} مگابایت',
                  style: _body.copyWith(fontSize: 12.5),
                ),
                const Spacer(),
                if (known) Text('${(ratio! * 100).floor()}٪', style: _body.copyWith(fontSize: 12.5, fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        );
      },
    );
  }
}

/// ". → .. → ..." over and over while downloading. A fixed width, so the sentence never jumps.
class _Dots extends StatefulWidget {
  const _Dots();

  @override
  State<_Dots> createState() => _DotsState();
}

class _DotsState extends State<_Dots> {
  int _n = 1;
  late final Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 450), (_) {
      if (mounted) setState(() => _n = _n % 3 + 1);
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 22,
      child: Text(
        '.' * _n,
        style: AppTypography.bodyMedium.copyWith(color: const Color(0xFFD3D0E3), fontWeight: FontWeight.w700),
      ),
    );
  }
}
