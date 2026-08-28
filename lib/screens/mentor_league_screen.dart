import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../widgets/safe_avatar.dart';

class MentorLeagueScreen extends StatefulWidget {
  const MentorLeagueScreen({super.key});

  @override
  State<MentorLeagueScreen> createState() => _MentorLeagueScreenState();
}

class _MentorLeagueScreenState extends State<MentorLeagueScreen> {
  int _selectedLeagueTab = 0;

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final caravansList = repository.caravans.toList();
    caravansList.sort((a, b) => b.overallProgress.compareTo(a.overallProgress));

    final currentUser = repository.currentUser;
    final List<Map<String, dynamic>> wealthyPlayers = [];
    
    wealthyPlayers.add({
      'name': currentUser.name,
      'zarik': currentUser.zarikBalance,
      'assets': '${currentUser.nakh} نخ  ·  ${currentUser.beyragh} بیرق  ·  ${currentUser.farsh} فرش',
      'avatar': currentUser.avatarUrl ?? 'http://127.0.0.1:5000/uploads/avatars/default.png',
      'isMe': true,
      'mentorLevel': currentUser.mentorLevel,
    });
    
    wealthyPlayers.sort((a, b) => (b['zarik'] as int).compareTo(a['zarik'] as int));

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        title: const Text('تالار افتخارات و لیگ نپا', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, fontFamily: 'Vazirmatn')),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      body: Column(
        children: [
          // Custom Toggle Tab Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF1E1435),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedLeagueTab = 1),
                      child: Container(
                        decoration: BoxDecoration(
                          color: _selectedLeagueTab == 1 ? const Color(0xFF8B5CF6) : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: Text(
                            'لیگ ثروتمندان 💰',
                            style: TextStyle(
                              color: _selectedLeagueTab == 1 ? Colors.white : Colors.white60,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedLeagueTab = 0),
                      child: Container(
                        decoration: BoxDecoration(
                          color: _selectedLeagueTab == 0 ? const Color(0xFF8B5CF6) : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: Text(
                            'لیگ کاروان‌ها 🗺️',
                            style: TextStyle(
                              color: _selectedLeagueTab == 0 ? Colors.white : Colors.white60,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          Expanded(
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: _selectedLeagueTab == 0
                  ? ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: caravansList.length,
                      itemBuilder: (context, index) {
                        final caravan = caravansList[index];
                        final rank = index + 1;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E1435),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: rank == 1 ? const Color(0xFFFFD54F).withValues(alpha: 0.2) : Colors.white10,
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    '$rank',
                                    style: TextStyle(
                                      color: rank == 1 ? const Color(0xFFFFD54F) : Colors.white70,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      caravan.name,
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'Vazirmatn'),
                                    ),
                                    const SizedBox(height: 6),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: LinearProgressIndicator(
                                        value: caravan.overallProgress,
                                        minHeight: 6,
                                        backgroundColor: Colors.white10,
                                        valueColor: const AlwaysStoppedAnimation(Color(0xFF10B981)),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'پیشرفت: ${(caravan.overallProgress * 100).toInt()}%  ·  اعضا: ${caravan.memberCount} نفر',
                                      style: const TextStyle(color: Colors.white38, fontSize: 10, fontFamily: 'Vazirmatn'),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: wealthyPlayers.length,
                      itemBuilder: (context, index) {
                        final player = wealthyPlayers[index];
                        final rank = index + 1;
                        final isMe = player['isMe'] == true;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isMe ? const Color(0xFF8B5CF6).withValues(alpha: 0.1) : const Color(0xFF1E1435),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isMe ? const Color(0xFF8B5CF6).withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.03),
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: rank == 1 ? const Color(0xFFFFD54F).withValues(alpha: 0.2) : Colors.white10,
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    '$rank',
                                    style: TextStyle(
                                      color: rank == 1 ? const Color(0xFFFFD54F) : Colors.white70,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Stack(
                                clipBehavior: Clip.none,
                                children: [
                                    SafeAvatar(
                                      radius: 20,
                                      imageUrl: player['avatar'],
                                      name: player['name'] ?? 'بازیکن',
                                      backgroundColor: Colors.white24,
                                    ),
                                  if (player['mentorLevel'] != null)
                                    Positioned(
                                      bottom: -4,
                                      right: -4,
                                      child: Container(
                                        padding: const EdgeInsets.all(2),
                                        decoration: BoxDecoration(
                                          color: player['mentorLevel'] == 3 
                                              ? const Color(0xFFFFD700) 
                                              : (player['mentorLevel'] == 2 ? const Color(0xFFC0C0C0) : const Color(0xFFCD7F32)),
                                          shape: BoxShape.circle,
                                          border: Border.all(color: const Color(0xFF0F081D), width: 1),
                                        ),
                                        child: const Icon(Icons.star, size: 8, color: Colors.black),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          player['name'],
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: isMe ? FontWeight.w900 : FontWeight.bold,
                                            fontSize: 13,
                                            fontFamily: 'Vazirmatn',
                                          ),
                                        ),
                                        if (isMe) ...[
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(color: const Color(0xFF8B5CF6), borderRadius: BorderRadius.circular(6)),
                                            child: const Text('من', style: TextStyle(color: Colors.white, fontSize: 8, fontFamily: 'Vazirmatn')),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      player['assets'],
                                      style: const TextStyle(color: Colors.white38, fontSize: 10, fontFamily: 'Vazirmatn'),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '${player['zarik']} 🪙',
                                style: const TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
