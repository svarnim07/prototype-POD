import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Plus, ChevronLeft, Trash2, Loader2, Save } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/create-exam', label: 'Create Exam', icon: Plus },
];

export default function CreateExam() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [exam, setExam] = useState({ title: '', description: '', duration: 60, startTime: '', endTime: '', studentIds: [] });
  const [questions, setQuestions] = useState([{ type: 'MCQ', content: '', options: ['','','',''], answer: '', marks: 2 }]);
  const [createdExamId, setCreatedExamId] = useState(null);

  useEffect(() => {
    api.get('/users').then(r => setStudents(r.data.filter(u => u.role === 'STUDENT'))).catch(() => {});
  }, []);

  const toggleStudent = (id) => setExam(e => ({
    ...e, studentIds: e.studentIds.includes(id) ? e.studentIds.filter(s => s !== id) : [...e.studentIds, id]
  }));

  const addQuestion = () => setQuestions(q => [...q, { type: 'MCQ', content: '', options: ['','','',''], answer: '', marks: 2 }]);
  const removeQuestion = (i) => setQuestions(q => q.filter((_, idx) => idx !== i));
  const updateQ = (i, field, val) => setQuestions(q => q.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const updateOption = (qi, oi, val) => setQuestions(q => q.map((item, idx) => idx === qi ? { ...item, options: item.options.map((o, oidx) => oidx === oi ? val : o) } : item));

  const handleCreateExam = async () => {
    if (!exam.title || !exam.duration || !exam.startTime || !exam.endTime)
      return toast.error('Fill all required fields');
    setSaving(true);
    try {
      const res = await api.post('/exams', exam);
      setCreatedExamId(res.data.id);
      setStep(2);
      toast.success('Exam created! Now add questions.');
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed to create exam'); }
    finally { setSaving(false); }
  };

  const handleSaveQuestions = async () => {
    if (questions.some(q => !q.content)) return toast.error('All questions need content');
    setSaving(true);
    try {
      const payload = questions.map((q, i) => ({
        type: q.type, content: q.content, marks: parseInt(q.marks) || 1, order: i,
        options: q.type === 'MCQ' ? q.options.filter(Boolean) : undefined,
        answer: q.type === 'MCQ' ? q.answer : undefined,
      }));
      await api.post('/questions/bulk', { examId: createdExamId, questions: payload });
      toast.success('Exam published!');
      navigate('/faculty');
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex' }}>
      <div className="gradient-mesh" />
      <Sidebar navItems={NAV} />
      <main className="main-content">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Link to="/faculty" className="btn-ghost" style={{ padding: '8px' }}><ChevronLeft size={18} /></Link>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Create Exam</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Step {step} of 2</p>
            </div>
          </div>

          {step === 1 && (
            <div style={{ maxWidth: 620 }}>
              <div className="glass-sm" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label">Exam Title *</label>
                  <input className="input" placeholder="e.g. Midterm Exam" value={exam.title} onChange={e => setExam(x => ({ ...x, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input" placeholder="Brief description..." value={exam.description} onChange={e => setExam(x => ({ ...x, description: e.target.value }))} style={{ minHeight: 80, resize: 'vertical' }} />
                </div>
                <div>
                  <label className="label">Duration (minutes) *</label>
                  <input className="input" type="number" min={5} value={exam.duration} onChange={e => setExam(x => ({ ...x, duration: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="label">Start Time *</label>
                    <input className="input" type="datetime-local" value={exam.startTime} onChange={e => setExam(x => ({ ...x, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Time *</label>
                    <input className="input" type="datetime-local" value={exam.endTime} onChange={e => setExam(x => ({ ...x, endTime: e.target.value }))} />
                  </div>
                </div>
                {students.length > 0 && (
                  <div>
                    <label className="label">Assign Students ({exam.studentIds.length} selected)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      {students.map(s => (
                        <button key={s.id} type="button" onClick={() => toggleStudent(s.id)}
                          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, border: `1px solid ${exam.studentIds.includes(s.id) ? 'var(--accent)' : 'var(--border)'}`, background: exam.studentIds.includes(s.id) ? 'var(--accent-glow)' : 'transparent', color: exam.studentIds.includes(s.id) ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn-primary" onClick={handleCreateExam} disabled={saving} style={{ padding: '12px 28px' }}>
                  {saving ? <Loader2 size={16} className="spin" /> : 'Next: Add Questions →'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {questions.map((q, qi) => (
                  <div key={qi} className="glass-sm" style={{ padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>Q{qi + 1}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <select className="input" value={q.type} onChange={e => updateQ(qi, 'type', e.target.value)} style={{ width: 130, padding: '6px 10px', fontSize: 13 }}>
                          <option value="MCQ">MCQ</option>
                          <option value="SUBJECTIVE">Subjective</option>
                          <option value="CODING">Coding</option>
                        </select>
                        <input className="input" type="number" min={1} value={q.marks} onChange={e => updateQ(qi, 'marks', e.target.value)} style={{ width: 70, padding: '6px 10px', fontSize: 13 }} />
                        {questions.length > 1 && (
                          <button onClick={() => removeQuestion(qi)} style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea className="input" placeholder="Question content..." value={q.content} onChange={e => updateQ(qi, 'content', e.target.value)} style={{ minHeight: 80, resize: 'vertical', marginBottom: 10 }} />
                    {q.type === 'MCQ' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {q.options.map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="radio" name={`ans-${qi}`} checked={q.answer === opt && opt !== ''} onChange={() => updateQ(qi, 'answer', opt)} style={{ accentColor: 'var(--accent)' }} />
                            <input className="input" placeholder={`Option ${String.fromCharCode(65+oi)}`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} style={{ padding: '8px 12px', fontSize: 13 }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-ghost" onClick={addQuestion}><Plus size={16} /> Add Question</button>
                <button className="btn-primary" onClick={handleSaveQuestions} disabled={saving} style={{ padding: '11px 24px' }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <><Save size={16} /> Publish Exam</>}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
