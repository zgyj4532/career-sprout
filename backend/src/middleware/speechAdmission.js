import { campusError } from '../campus/errors.js';
import { withDiagnosticContext } from '../utils/diagnostics.js';

let active = false;
export function speechAdmission(upload, handler) {
  return (req, res, next) => {
    if (active) return next(campusError(429, 'ASR_BUSY', '已有录音正在处理，请稍后重试。'));
    active = true;
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(campusError(499, 'REQUEST_ABORTED', '转写已取消。')); };
    req.once('aborted', abort);
    res.once('close', abort);
    req.speechSignal = controller.signal;
    const release = () => {
      req.removeListener('aborted', abort);
      res.removeListener('close', abort);
      if (req.file) req.file.buffer = null;
      active = false;
    };
    try {
      upload(req, res, (error) => {
        if (error) { release(); return next(error); }
        withDiagnosticContext(req.requestId, () => {
          Promise.resolve().then(() => { controller.signal.throwIfAborted(); return handler(req, res); })
            .catch(next).finally(release);
        });
      });
    } catch (error) { release(); next(error); }
  };
}
