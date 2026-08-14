import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../services/api_service.dart';

typedef OnSubmitted = void Function(bool success);

class HomeworkWidget extends StatefulWidget {
  final String challengeId;
  final String type; // 'text' | 'multiple_choice' | 'file'
  final List<Map<String, dynamic>>? questions;
  final OnSubmitted? onSubmitted;

  const HomeworkWidget({super.key, required this.challengeId, required this.type, this.questions, this.onSubmitted});

  @override
  State<HomeworkWidget> createState() => _HomeworkWidgetState();
}

class _HomeworkWidgetState extends State<HomeworkWidget> {
  final TextEditingController _textCtrl = TextEditingController();
  int _selectedChoice = -1;
  PlatformFile? _pickedFile;
  bool _submitting = false;

  Future<void> _pickFile() async {
    final res = await FilePicker.platform.pickFiles(type: FileType.any);
    if (res != null && res.files.isNotEmpty) {
      setState(() => _pickedFile = res.files.first);
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    final api = HttpApiService();

    String answerText = '';
    if (widget.type == 'text') {
      answerText = _textCtrl.text.trim();
      if (answerText.isEmpty && _pickedFile == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('پاسخ یا فایل لازم است')));
        setState(() => _submitting = false);
        return;
      }
    } else if (widget.type == 'multiple_choice') {
      if (_selectedChoice < 0) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('پاسخ را انتخاب کنید')));
        setState(() => _submitting = false);
        return;
      }
      answerText = 'choice:$_selectedChoice';
    }

    String? fileUrl;
    if (_pickedFile != null) {
      final p = _pickedFile!.path;
      if (p == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('فایل انتخاب‌شده قابل دسترسی نیست')));
        setState(() => _submitting = false);
        return;
      }
      final file = File(p);
      final upload = await api.uploadMediaFile(file, assetType: 'submission', title: _pickedFile!.name);
      if (upload != null && upload['media'] != null) {
        fileUrl = upload['media']['url'] ?? upload['media']['url'];
      }
    }

    final ok = await api.submitTask(widget.challengeId, answerText.isEmpty ? (fileUrl ?? '') : answerText);

    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('پاسخ ارسال شد')));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('خطا در ارسال')));
    }

    setState(() => _submitting = false);
    widget.onSubmitted?.call(ok);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (widget.type == 'text') ...[
          TextField(controller: _textCtrl, maxLines: 4, decoration: const InputDecoration(hintText: 'پاسخ خود را بنویسید')),
        ],
        if (widget.type == 'multiple_choice' && widget.questions != null) ...[
          ...widget.questions!.asMap().entries.map((e) {
            final q = e.value;
            return ListTile(
              title: Text(q['q'] ?? ''),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: (q['options'] as List).asMap().entries.map((opt) {
                  final oi = opt.key;
                  final text = opt.value;
                  // ignore: deprecated_member_use
                  return RadioListTile<int>(value: oi, groupValue: _selectedChoice, onChanged: (v) => setState(() => _selectedChoice = v ?? -1), title: Text(text));
                }).toList(),
              ),
            );
          }),
        ],
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            ElevatedButton.icon(onPressed: _pickFile, icon: const Icon(Icons.attach_file), label: const Text('ضمیمه فایل')),
            ElevatedButton.icon(onPressed: _submitting ? null : _submit, icon: const Icon(Icons.send), label: Text(_submitting ? 'درحال ارسال...' : 'ارسال')),
          ],
        ),
        if (_pickedFile != null) Padding(padding: const EdgeInsets.only(top:8.0), child: Text('فایل انتخاب‌شده: ${_pickedFile!.name}')),
      ],
    );
  }
}
