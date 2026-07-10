// Feedback widget: header button + one-time gentle prompt after a quiz submit.
// POSTs to /api/v1/feedback (JWT-authed). localStorage flags:
//   gpusim_feedback_done     — user submitted once; never auto-prompt again
//   gpusim_feedback_prompted — auto-prompt shown once; never auto-prompt again

let feedbackRating = 0;

function openFeedback(context = 'manual') {
  const overlay = document.getElementById('feedback-overlay');
  if (!overlay) return;
  overlay.dataset.context = context;
  feedbackRating = 0;
  renderFeedbackStars();
  const message = document.getElementById('feedback-message');
  if (message) message.value = '';
  const err = document.getElementById('feedback-error');
  if (err) err.style.display = 'none';
  document.getElementById('feedback-form-body')?.style.setProperty('display', 'block');
  document.getElementById('feedback-thanks')?.style.setProperty('display', 'none');
  overlay.classList.add('show');
}

function closeFeedback() {
  document.getElementById('feedback-overlay')?.classList.remove('show');
}

function maybePromptFeedback(context) {
  try {
    if (localStorage.getItem('gpusim_feedback_done') === 'true') return;
    if (localStorage.getItem('gpusim_feedback_prompted') === 'true') return;
    localStorage.setItem('gpusim_feedback_prompted', 'true');
  } catch (_e) { return; }
  openFeedback(context);
}

function renderFeedbackStars() {
  document.querySelectorAll('#feedback-stars .feedback-star').forEach((star) => {
    const val = Number(star.dataset.star);
    star.classList.toggle('active', val <= feedbackRating);
    star.setAttribute('aria-checked', String(val === feedbackRating));
  });
}

function setFeedbackRating(val) {
  feedbackRating = val;
  renderFeedbackStars();
}

function showFeedbackError(text) {
  const err = document.getElementById('feedback-error');
  if (!err) return;
  err.textContent = text;
  err.style.display = 'block';
}

async function submitFeedback() {
  if (!feedbackRating) {
    showFeedbackError('Pick a star rating first.');
    return;
  }
  const message = String(document.getElementById('feedback-message')?.value || '').trim();
  const context = document.getElementById('feedback-overlay')?.dataset.context || 'manual';
  const btn = document.getElementById('btn-feedback-submit');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHdr() },
      body: JSON.stringify({ rating: feedbackRating, message, context }),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({})))?.detail;
      throw new Error(detail || `HTTP ${res.status}`);
    }
    try { localStorage.setItem('gpusim_feedback_done', 'true'); } catch (_e) { /* private mode */ }
    document.getElementById('feedback-form-body')?.style.setProperty('display', 'none');
    document.getElementById('feedback-thanks')?.style.setProperty('display', 'block');
  } catch (exc) {
    showFeedbackError(String(exc.message || 'Could not send feedback — please try again.'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('click', (event) => {
  const star = event.target.closest('#feedback-stars .feedback-star');
  if (star) { setFeedbackRating(Number(star.dataset.star)); return; }
  if (event.target.closest('#btn-feedback')) { openFeedback('manual'); return; }
  if (event.target.closest('#btn-feedback-submit')) { submitFeedback(); return; }
  if (event.target.closest('#btn-feedback-close, #btn-feedback-later, #btn-feedback-thanks-close')) {
    closeFeedback();
  }
});
