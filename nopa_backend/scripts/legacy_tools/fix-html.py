import re

path = 'public/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the start and end of the block to replace
start_marker = '<div class="panel-card glass" id="caravan-workspace-box"'
end_marker = '</div>\n        </section>\n  \n        <!-- TAB 5'

start_idx = content.find(start_marker)
if start_idx == -1:
    print("Start marker not found")
    exit(1)

end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("End marker not found")
    exit(1)

new_block = """<div class="panel-card glass" id="caravan-workspace-box" style="margin-top: 24px; padding: 24px; border-radius: 16px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08);">
  
  <!-- Header & Dropdown -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <h3 style="color: white; font-size: 17px; margin: 0; font-weight: bold;">مدیریت و جزئیات کاروان</h3>
    <div style="display: flex; align-items: center; gap: 10px;">
      <label style="color: #94a3b8; font-size: 13px;">انتخاب کاروان:</label>
      <select id="ws-caravan-picker" class="select-ctrl" style="min-width: 220px; padding: 8px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: white;" onchange="window.onWorkspaceCaravanChanged(this.value)">
        <option value="">-- لطفاً یک کاروان انتخاب کنید --</option>
      </select>
    </div>
  </div>

  <!-- 3 Minimalist Metric Cards -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
    
    <!-- Right: Mentor -->
    <div class="stat-card glass" style="padding: 20px; border-radius: 12px; text-align: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">راهبر اختصاصی</div>
      <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
        <span id="ws-mentor-name" style="font-size: 17px; font-weight: bold; color: #38bdf8;">--</span>
        <button type="button" onclick="window.openReassignMentorModal()" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 13px;" title="تغییر راهبر"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>

    <!-- Center: Wealth -->
    <div class="stat-card glass" style="padding: 20px; border-radius: 12px; text-align: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">مجموع ثروت (زریک)</div>
      <div id="ws-total-zarik" style="font-size: 18px; font-weight: bold; color: #fbbf24; display: flex; justify-content: center; align-items: center; gap: 6px;">
        <i class="fa-solid fa-coins" style="font-size: 16px;"></i> <span>0</span>
      </div>
    </div>

    <!-- Left: Completed Stations -->
    <div class="stat-card glass" style="padding: 20px; border-radius: 12px; text-align: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">ایستگاههای تکمیل شده</div>
      <div id="ws-stations-completed" style="font-size: 18px; font-weight: bold; color: #10b981;">0</div>
    </div>

  </div>

  <!-- Add Member Action Bar -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
    <button type="button" onclick="window.openAddMemberModal()" class="btn-primary" style="background: #10b981; color: white; padding: 7px 16px; font-size: 13px; font-weight: bold; border-radius: 8px; border: none; cursor: pointer;">
      + افزودن دانشآموز به کاروان
    </button>
  </div>

  <!-- Roster Table -->
  <div class="table-container" style="background: transparent; border-radius: 10px; overflow-x: auto; border: 1px solid rgba(255,255,255,0.05);">
    <table class="data-table" id="ws-roster-table" style="width: 100%; border-collapse: collapse; text-align: center; font-size: 13px;">
      <thead>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-weight: 500;">
          <th style="padding: 12px; text-align: right;">شناسه</th>
          <th style="padding: 12px; text-align: right;">نام عضو</th>
          <th style="padding: 12px;">شماره تماس</th>
          <th style="padding: 12px;">موجودی زریک</th>
          <th style="padding: 12px; text-align: center;">عملیات</th>
        </tr>
      </thead>
      <tbody id="ws-roster-tbody">
        <tr><td colspan="5" style="text-align: center; color: #64748b; padding: 24px;">لطفاً یک کاروان را انتخاب نمایید</td></tr>
      </tbody>
    </table>
  </div>
</div>
"""

new_content = content[:start_idx] + new_block + content[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Updated index.html")
