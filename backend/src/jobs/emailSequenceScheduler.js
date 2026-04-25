import { logger } from '../shared/utils/logger.js';
import { sendEmail } from '../shared/services/brevo.service.js';
import * as model from '../modules/email-sequences/sequence.model.js';

const TICK_MS = parseInt(process.env.EMAIL_SEQ_TICK_MS || String(2 * 60 * 1000)); // 2 min default

let running = false;

async function processOne(run) {
  const step = run.steps?.[run.current_step];
  if (!step) {
    await model.advanceRun(run.id, 'no step');
    return;
  }
  const to = run.lead_email;
  if (!to) {
    await model.advanceRun(run.id, 'lead sin email');
    return;
  }
  try {
    const result = await sendEmail({
      to,
      subject: step.subject || `Seguimiento (${run.current_step + 1})`,
      htmlContent: step.body || '<p>Hola</p>',
      tags: ['email-sequence', `seq-${run.sequence_id}`],
      projectId: run.project_id,
    });
    await model.advanceRun(run.id, result.sent === false ? (result.reason || 'no-send') : null);
    logger.info({ runId: run.id, to, step: run.current_step }, 'Email seguimiento procesado');
  } catch (err) {
    await model.advanceRun(run.id, err.message?.slice(0, 500));
    logger.error({ err, runId: run.id }, 'Error enviando email seguimiento');
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const due = await model.findDueRuns(20);
    for (const r of due) await processOne(r);
  } catch (err) {
    logger.error({ err }, 'Email seq scheduler tick error');
  } finally {
    running = false;
  }
}

export function startEmailSequenceScheduler() {
  if (process.env.EMAIL_SEQ_DISABLED === '1') {
    logger.warn('Email sequence scheduler deshabilitado por EMAIL_SEQ_DISABLED=1');
    return;
  }
  setInterval(tick, TICK_MS);
  logger.info({ tickMs: TICK_MS }, 'Email sequence scheduler iniciado');
}
