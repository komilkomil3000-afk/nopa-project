const fs = require('fs');
let html = fs.readFileSync('./public/index.html', 'utf8');

const marker1 = '      <!-- LMS -->';
const marker2 = '      <!-- DYNAMIC FORM BUILDER -->';

const p1 = html.indexOf(marker1);
const p2 = html.indexOf(marker2);

if (p1 !== -1 && p2 !== -1) {
  const lmsContent = `      <!-- LMS -->
      <section id="lms-tab" class="tab-panel" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3>ساختار منزلگاه‌ها و مدیریت کلاس‌ها و آزمون‌ها</h3>
          <div style="display: flex; gap: 10px;">
            <button type="button" onclick="window.openCreateStationModal()" class="btn-primary" style="background-color: #6366f1;">
              <i class="fa-solid fa-plus"></i> ایجاد منزلگاه جدید
            </button>
          </div>
        </div>

        <!-- 3 Key Stat Cards -->
        <div class="stats-grid" style="margin-bottom: 20px;">
          <div class="stat-card glass">
            <div>
              <div class="stat-label">کل منزلگاه‌های آموزشی</div>
              <div class="stat-value" id="lms-stat-stations" style="color: #818cf8;">۵ منزلگاه</div>
            </div>
            <div class="stat-icon" style="color: #6366f1; background: rgba(99, 102, 241, 0.1);"><i class="fa-solid fa-compass"></i></div>
          </div>
          <div class="stat-card glass">
            <div>
              <div class="stat-label">مجموع جلسات مصوب</div>
              <div class="stat-value" id="lms-stat-sessions" style="color: #34d399;">۴۰ جلسه</div>
            </div>
            <div class="stat-icon" style="color: #10b981; background: rgba(16, 185, 129, 0.1);"><i class="fa-solid fa-graduation-cap"></i></div>
          </div>
          <div class="stat-card glass">
            <div>
              <div class="stat-label">بانک آزمون‌ها و پارت‌ها</div>
              <div class="stat-value" id="lms-stat-quizzes" style="color: #fbbf24;">۳۲۰ پارت ویدیو</div>
            </div>
            <div class="stat-icon" style="color: #f59e0b; background: rgba(245, 158, 11, 0.1);"><i class="fa-solid fa-file-signature"></i></div>
          </div>
        </div>

        <!-- Actions & Filters Header -->
        <div class="actions-header glass" style="margin-bottom: 20px;">
          <div class="filters-group" style="flex: 1;">
            <div class="search-box" style="flex: 1; min-width: 250px;">
              <i class="fa-solid fa-search"></i>
              <input type="text" id="lms-search-input" class="input-ctrl" placeholder="جستجو بر اساس نام منزلگاه، سرفصل یا استاد..." oninput="window.filterLmsTable()">
            </div>
            <select id="lms-filter-category" class="select-ctrl" onchange="window.filterLmsTable()">
              <option value="all">همه دسته‌ها</option>
              <option value="ترکیبی">ترکیبی (مهارتی + رسانه‌ای)</option>
              <option value="مهارتی">مهارتی</option>
              <option value="رسانه‌ای">رسانه‌ای</option>
            </select>
            <select id="lms-filter-instructor" class="select-ctrl" onchange="window.filterLmsTable()">
              <option value="all">همه اساتید</option>
              <option value="خوش‌منظر">علیرضا خوش‌منظر</option>
              <option value="پیراینه‌گر">پیراینه‌گر</option>
              <option value="پیرچهره‌تراش">پیرچهره‌تراش</option>
              <option value="پیردیده‌بان">پیردیده‌بان</option>
              <option value="پیرناخدا">پیرناخدا</option>
              <option value="پیرمنجم">پیرمنجم</option>
              <option value="حیدری">حیدری</option>
              <option value="زاهدی">کمیل زاهدی</option>
            </select>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" onclick="window.exportLmsToExcel()" class="btn-action btn-export">
              <i class="fa-solid fa-file-excel" style="color: #10b981;"></i> خروجی اکسل
            </button>
            <button type="button" onclick="window.fetchLiveLmsStations()" class="btn-action btn-export">
              <i class="fa-solid fa-sync"></i> بروزرسانی
            </button>
          </div>
        </div>

        <!-- LMS Stations Data Table -->
        <div class="table-container glass">
          <table class="data-table" id="lms-stations-table">
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">کد</th>
                <th>نام منزلگاه</th>
                <th>اساتید دوره</th>
                <th style="text-align: center;">دسته کلاس</th>
                <th>زمان‌بندی برگزاری</th>
                <th style="text-align: center;">جلسات و پارت‌ها</th>
                <th style="text-align: center;">وضعیت</th>
                <th style="width: 140px; text-align: center;">عملیات</th>
              </tr>
            </thead>
            <tbody id="lms-directory-tbody">
              <!-- Dynamically rendered -->
            </tbody>
          </table>
        </div>

        <!-- Station Inspector & Edit Modal -->
        <div id="lms-station-creator-modal" class="modal-overlay" style="display: none;">
          <div class="modal-content glass" style="max-width: 750px; width: 90%; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
              <h3 id="station-modal-title" style="margin: 0; color: var(--color-neon-blue); font-size: 18px;">
                <i class="fa-solid fa-graduation-cap"></i> تعریف / ویرایش منزلگاه آموزشی
              </h3>
              <button type="button" class="modal-close" onclick="document.getElementById('lms-station-creator-modal').style.display='none'" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">&times;</button>
            </div>

            <form id="lms-creator-form" onsubmit="window.saveCompleteStation(event)">
              <input type="hidden" id="modal-st-id">
              
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; margin-bottom: 15px;">
                <div class="form-group">
                  <label>شماره منزلگاه (ایندکس):</label>
                  <input type="number" id="modal-st-index" class="input-ctrl" min="1" max="20" required>
                </div>
                <div class="form-group">
                  <label>عنوان منزلگاه:</label>
                  <input type="text" id="modal-st-title" class="input-ctrl" placeholder="مثال: مبانی شناخت و رسانه (شوک و اینشات)" required>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div class="form-group">
                  <label>نوع و دسته کلاس:</label>
                  <select id="modal-st-cat" class="select-ctrl" style="width: 100%;">
                    <option value="ترکیبی">ترکیبی (مهارتی + رسانه‌ای)</option>
                    <option value="مهارتی">صرفاً مهارتی (شنبه و دوشنبه)</option>
                    <option value="رسانه‌ای">صرفاً رسانه‌ای (۵شنبه و جمعه)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>اساتید دوره:</label>
                  <input type="text" id="modal-st-instructors" class="input-ctrl" placeholder="پیراینه‌گر (مهارتی) / علیرضا خوش‌منظر (رسانه‌ای)" required>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div class="form-group">
                  <label>زمان‌بندی برگزاری:</label>
                  <input type="text" id="modal-st-schedule" class="input-ctrl" value="شنبه و دوشنبه / ۵شنبه و جمعه" required>
                </div>
                <div class="form-group">
                  <label>تعداد جلسات مصوب:</label>
                  <input type="number" id="modal-st-sessions" class="input-ctrl" value="4" min="1" max="50" required>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 20px;">
                <label>توضیحات، سرفصل‌ها و آزمون‌های ۴ گزینه‌ای:</label>
                <textarea id="modal-st-details" class="input-ctrl" rows="3" placeholder="سرفصل‌های جلسات، پارت‌های آموزشی، آزمون‌ها و تکالیف..."></textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <button type="button" class="btn-action" onclick="document.getElementById('lms-station-creator-modal').style.display='none'">انصراف</button>
                <button type="submit" class="btn-primary" style="background: #6366f1;">ذخیره و ثبت منزلگاه</button>
              </div>
            </form>
          </div>
        </div>
      </section>\n\n`;

  html = html.substring(0, p1) + lmsContent + html.substring(p2);
  fs.writeFileSync('./public/index.html', html, 'utf8');
  console.log('Successfully replaced lms-tab');
} else {
  console.log('Markers not found', p1, p2);
}
