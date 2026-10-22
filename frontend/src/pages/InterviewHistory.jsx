import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { interviewApi } from "../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, isAfter } from "date-fns";
import { Calendar, Briefcase, Clock, Trophy, ChevronRight, FilterX } from "lucide-react";
import { comparisonKey, interviewScore, scoreRule } from '../utils/interviewScores';

export default function InterviewHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [scoreGroup, setScoreGroup] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await interviewApi.getHistory();
      setHistory(response.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique roles for the filter dropdown
  const uniqueRoles = useMemo(() => {
    const roles = new Set(history.map(h => h.jobRole).filter(Boolean));
    return Array.from(roles);
  }, [history]);

  // Apply filters
  const filteredHistory = useMemo(() => {
    return history.filter(session => {
      // Role Filter
      if (roleFilter !== "all" && session.jobRole !== roleFilter) return false;

      // Date Filter
      const sessionDate = new Date(session.completedAt || session.createdAt);
      if (dateFilter === "7days" && !isAfter(sessionDate, subDays(new Date(), 7))) return false;
      if (dateFilter === "30days" && !isAfter(sessionDate, subDays(new Date(), 30))) return false;

      // Score Filter
      const score = interviewScore(session);
      if (scoreFilter !== 'all' && score === null) return false;
      if (scoreFilter === "high" && score < 80) return false;
      if (scoreFilter === "medium" && (score < 50 || score >= 80)) return false;
      if (scoreFilter === "low" && score >= 50) return false;

      return true;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Sort chronological for chart
  }, [history, roleFilter, dateFilter, scoreFilter]);

  const scoreGroups = [...new Set(filteredHistory.map(comparisonKey).filter(Boolean))];
  const selectedGroup = scoreGroups.includes(scoreGroup) ? scoreGroup : scoreGroups[0];
  const comparable = filteredHistory.filter(session => comparisonKey(session) === selectedGroup && selectedGroup);
  const chartData = comparable.map(session => ({
    ...session,
    dateFormatted: format(new Date(session.completedAt || session.createdAt), 'MMM d'),
    score: interviewScore(session)
  }));

  const clearFilters = () => {
    setRoleFilter("all");
    setDateFilter("all");
    setScoreFilter("all");
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Interview History</h1>
          <p className="text-muted-foreground mt-1">Review your past mock interviews and track your progress.</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-border/50">
          <Trophy className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No Interviews Yet</h2>
          <p className="text-muted-foreground mb-6">Start your first mock interview to see your history and analytics here.</p>
          <button 
            onClick={() => navigate('/interview-prep')}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Start Mock Interview
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Filters and List */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FilterX className="w-4 h-4 text-muted-foreground" />
                  Filters
                </h3>
                <button onClick={clearFilters} className="text-xs text-primary hover:underline font-medium">
                  Clear All
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Job Role</label>
                  <select 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="all">All Roles</option>
                    {uniqueRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date Range</label>
                  <select 
                    value={dateFilter} 
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="all">All Time</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Score Range</label>
                  <select 
                    value={scoreFilter} 
                    onChange={(e) => setScoreFilter(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="all">Any Score</option>
                    <option value="high">Strong (≥80)</option>
                    <option value="medium">Good (50-79)</option>
                    <option value="low">Needs Work (&lt;50)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sessions List */}
            <div className="space-y-4 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-10 bg-muted/10 rounded-xl border border-dashed border-border">
                  <p className="text-muted-foreground text-sm">No interviews match your filters.</p>
                </div>
              ) : (
                [...filteredHistory].reverse().map((session) => (
                  <Link
                    key={session._id}
                    to={`/interview-history/${session._id}`}
                    className="block bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all rounded-xl p-4 cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-foreground text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1 flex-1 pr-2">
                        {session.purpose === 'discovery' ? 'Interest discovery' : session.jobRole || 'General Interview'}
                      </h4>
                      <div className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold border ${interviewScore(session) === null ? '' : getScoreBadgeColor(interviewScore(session))}`}>
                        {interviewScore(session) === null ? 'Unscored' : `${interviewScore(session)}%`}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{scoreRule(session)}</p>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{format(new Date(session.completedAt || session.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{Math.round((session.duration || 0) / 60)}m</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Chart and Analytics */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Score Progression
              </h3>
              
              {chartData.length < 2 ? (
                <div className="h-[300px] flex flex-col items-center justify-center bg-muted/10 rounded-lg border border-dashed border-border">
                  <p className="text-muted-foreground text-sm mb-2">Not enough data to show a trend.</p>
                  <p className="text-xs text-muted-foreground">Complete more mock interviews to see your progress!</p>
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="dateFormatted" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))', 
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 600 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        name="Overall Score"
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }} 
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))' }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <label>Compare only the same scoring scope<select value={selectedGroup || ''} onChange={event => setScoreGroup(event.target.value)}>{scoreGroups.map(group => <option key={group} value={group}>{scoreRule(filteredHistory.find(session => comparisonKey(session) === group))}</option>)}</select></label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Sessions</p>
                <p className="text-2xl font-bold text-foreground">{filteredHistory.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Avg Score</p>
                <p className="text-2xl font-bold text-primary">
                  {comparable.length ? `${Math.round(comparable.reduce((sum, session) => sum + interviewScore(session), 0) / comparable.length)}%` : '—'}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Highest Score</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {comparable.length ? `${Math.max(...comparable.map(interviewScore))}%` : '—'}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Recent Trend</p>
                <p className={`text-2xl font-bold ${
                  comparable.length >= 2
                    ? (interviewScore(comparable[comparable.length - 1]) >= interviewScore(comparable[comparable.length - 2])
                        ? 'text-emerald-500' : 'text-amber-500')
                    : 'text-muted-foreground'
                }`}>
                  {comparable.length >= 2
                    ? (interviewScore(comparable[comparable.length - 1]) >= interviewScore(comparable[comparable.length - 2])
                        ? '↗' : '↘')
                    : '-'}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
