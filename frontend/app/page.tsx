import React from 'react';
import Link from 'next/link';
import ParticleWave from '@/components/landing/ParticleWave';
export default function LandingPage() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <ParticleWave />
      <header className="header">
        <nav className="nav wrap" aria-label="Main navigation">
          <Link className="brand" href="#" data-content="brand">
            <i className="brand-mark" aria-hidden="true"></i>
            <span>Origyn</span>
          </Link>
          <div className="nav-links">
            <Link href="#overview">Product</Link>
            <Link href="#updates">Resources</Link>
            <Link href="#customers">Customers</Link>
            <Link href="#closing">Pricing</Link>
            <Link href="#updates">News</Link>
            <Link href="#closing">Contact</Link>
          </div>
          <Link className="login" href="/workspace">Log in</Link>
          <Link className="button small" href="/workspace">Open workspace</Link>
          <button className="menu" aria-label="Open navigation" aria-expanded="false" aria-controls="mobile-nav">☰</button>
        </nav>
        <div id="mobile-nav" hidden>
          <Link href="#overview">Product</Link>
          <Link href="#planning">Planning</Link>
          <Link href="#automation">Automation</Link>
          <Link href="#customers">Customers</Link>
          <Link href="#closing">Get started</Link>
        </div>
      </header>
      
      <main id="main">
        <section className="hero wrap">
          <h1 data-content="hero.title">Evidence-aware research,<br/>from paper to claim to answer.</h1>
          <div className="hero-sub">
            <p data-content="hero.description">Upload scientific papers. Origyn tracks retraction status,<br/>extracts claims, and keeps answers traceable to current evidence.</p>
            <Link className="text-link" href="#automation">
              <strong>New</strong> &nbsp; Workspace API <span>→</span>
            </Link>
          </div>
          
          <div className="product-window hero-window" role="img" aria-label="Product dashboard layout placeholder">
            <aside className="sidebar">
              <b>◩ &nbsp; Workspace <span>⌄</span></b>
              <div>⌁ &nbsp; Overview</div>
              <div>▧ &nbsp; Sources</div>
              <div>◌ &nbsp; My library</div>
              <div>⑂ &nbsp; Reviews</div>
              <label>Analysis</label>
              <div>◈ &nbsp; Claims</div>
              <div>▦ &nbsp; Graph</div>
              <label>Favorites</label>
              <div className="selected">◧ &nbsp; Neuroplasticity Review</div>
              <div>◇ &nbsp; Agent tasks</div>
              <div>▥ &nbsp; Insights</div>
            </aside>
            <div className="issue">
              <div className="window-toolbar">
                <span><i className="status yellow"></i> DOC-001 &nbsp; Sleep-dependent consolidation &nbsp; <span className="star">✦</span></span>
                <span>··· <span className="muted">&nbsp; 1 / 84</span></span>
              </div>
              <div className="issue-body">
                <div className="issue-main">
                  <h3>Neuroplasticity literature review</h3>
                  <p>Evidence and provenance for your ongoing cognitive science literature review.<br/>Includes 12 uploaded sources.</p>
                  
                  <h4>Activity <span>···</span></h4>
                  
                  <div className="activity">
                    <i className="avatar">A</i>
                    <div>
                      <b>System</b> <small>· 2 min ago</small>
                      <p>Completed metadata extraction for 12 sources.</p>
                    </div>
                  </div>
                  
                  <div className="activity">
                    <i className="avatar purple">B</i>
                    <div>
                      <b>Research Assistant</b> <small>· just now</small>
                      <p>Drafting summary of learning rates based on uploaded literature.</p>
                      <div className="agent-response">
                        <span>◩ &nbsp; Agent <small>· connected</small></span>
                        <div className="skeleton long"></div>
                        <div className="skeleton"></div>
                        <div className="code-status">⑂ &nbsp; Draft ready for review <span>+24 −8</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <aside className="properties">
                  <h4>Properties</h4>
                  <p>◕ &nbsp; In progress</p>
                  <p>▥ &nbsp; Priority</p>
                  <p>◉ &nbsp; Assignee</p>
                  <p>◩ &nbsp; Agent</p>
                  
                  <h4>Labels</h4>
                  <span className="pill">Neuroscience</span>
                  <span className="pill">Review</span>
                  
                  <h4>Project</h4>
                  <p>◧ &nbsp; Thesis 2026</p>
                </aside>
              </div>
            </div>
          </div>
        </section>
        
        <div id="sections">
          <section className="customers-strip wrap reveal">
            <p>BUILT FOR RESEARCH TEAMS AND EVIDENCE-BASED WORKFLOWS</p>
            <div className="logos">
              <span>◈ <b>Research Hub</b></span>
              <span>▰ <b>Med Lab</b></span>
              <span>❋ <b>Bio Institute</b></span>
              <span>◒ <b>Data Sci</b></span>
              <span>⌘ <b>Policy Org</b></span>
              <span>✦ <b>Library Sys</b></span>
            </div>
          </section>
          
          <section id="overview" className="overview wrap section">
            <h2 className="statement reveal">
              <span>A new standard for evidence tracking.</span> Origyn automatically queries authoritative registries to keep your answers traceable to current evidence.
            </h2>
            <div className="principles reveal">
              <article>
                <div className="figure">
                  <small>FIG 0.1</small>
                  <div className="mini-layers">
                    <div>◈ &nbsp; Metadata extracted</div>
                    <div>▧ &nbsp; DOI identified</div>
                    <div>◌ &nbsp; Status confirmed</div>
                  </div>
                </div>
                <h3>Automated retraction checks</h3>
                <p>Identify the paper, query the authoritative registry, and surface the current status instantly.</p>
              </article>
              
              <article>
                <div className="figure">
                  <small>FIG 0.2</small>
                  <div className="mini-network">
                    <span>◈</span><i></i><b>✳</b><i></i><span>⌘</span>
                  </div>
                </div>
                <h3>Claim extraction</h3>
                <p>Break papers down into specific, attributable claims to track exactly which assertion informed an answer.</p>
              </article>
              
              <article>
                <div className="figure">
                  <small>FIG 0.3</small>
                  <div className="mini-speed">
                    <span>⌘</span><span>K</span>
                    <div>
                      <div className="skeleton" style={{width: '80%'}}></div>
                      <div className="skeleton" style={{width: '55%'}}></div>
                    </div>
                  </div>
                </div>
                <h3>Answers traceable to evidence</h3>
                <p>Ensure that generated text maintains a direct link back to the source document and its current status.</p>
              </article>
            </div>
          </section>
          
          <section id="intake" className="section capability wrap">
            <div className="section-head reveal">
              <div>
                <span className="eyebrow"><i className="section-dot dot-1"></i> Tracking</span>
                <h2>Source status<br/>at a glance</h2>
              </div>
              <div>
                <p>The workspace overview provides immediate visibility into the status of all uploaded literature.</p>
                <Link className="text-link" href="/workspace">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-board visual-panel reveal">
              <span className="visual-caption">SOURCES KANBAN</span>
              <div className="kanban">
                <div className="kanban-col">
                  <div className="column-label"><i className="status "></i>Active<span>8 &nbsp; +</span></div>
                  <div className="task-card">
                    <small>DOC-001</small>
                    <p>Sleep-dependent consolidation</p>
                    <div>
                      <span className="pill">Active</span><i className="avatar">A</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-002</small>
                    <p>Motor learning processes</p>
                    <div>
                      <span className="pill">Active</span><i className="avatar">B</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-003</small>
                    <p>Cognitive plasticity</p>
                    <div>
                      <span className="pill">Active</span><i className="avatar">C</i>
                    </div>
                  </div>
                </div>
                
                <div className="kanban-col">
                  <div className="column-label"><i className="status "></i>Processing<span>12 &nbsp; +</span></div>
                  <div className="task-card">
                    <small>DOC-004</small>
                    <p>Sensorimotor lifespan</p>
                    <div>
                      <span className="pill">Checking</span><i className="avatar">D</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-005</small>
                    <p>Working memory capacity</p>
                    <div>
                      <span className="pill">Checking</span><i className="avatar">E</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-006</small>
                    <p>Neurogenesis</p>
                    <div>
                      <span className="pill">Checking</span><i className="avatar">F</i>
                    </div>
                  </div>
                </div>
                
                <div className="kanban-col">
                  <div className="column-label"><i className="status yellow"></i>Needs Attention<span>3 &nbsp; +</span></div>
                  <div className="task-card">
                    <small>DOC-007</small>
                    <p>Repeated cognitive training</p>
                    <div>
                      <span className="pill">Retracted</span><i className="avatar">G</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-008</small>
                    <p>Longitudinal markers</p>
                    <div>
                      <span className="pill">Unknown</span><i className="avatar">H</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-009</small>
                    <p>Cortical thickness</p>
                    <div>
                      <span className="pill">Unknown</span><i className="avatar">I</i>
                    </div>
                  </div>
                </div>
                
                <div className="kanban-col">
                  <div className="column-label"><i className="status "></i>Archived<span>24 &nbsp; +</span></div>
                  <div className="task-card">
                    <small>DOC-010</small>
                    <p>Old study 1998</p>
                    <div>
                      <span className="pill">Archived</span><i className="avatar">J</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-011</small>
                    <p>Pilot data</p>
                    <div>
                      <span className="pill">Archived</span><i className="avatar">K</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-012</small>
                    <p>Draft manuscript</p>
                    <div>
                      <span className="pill">Archived</span><i className="avatar">L</i>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="floating-thread">
                <div className="thread-top">▧ &nbsp; Conversation <span>#general</span></div>
                <div className="activity">
                  <i className="avatar ">A</i>
                  <div>
                    <b>System</b><small> &nbsp; 12:35</small>
                    <p>Crossref monitoring detected a retraction notice for DOC-007.</p>
                  </div>
                </div>
                <div className="activity">
                  <i className="avatar purple">B</i>
                  <div>
                    <b>Researcher</b><small> &nbsp; 12:35</small>
                    <p>Acknowledged. Reviewing downstream claims affected by this source.</p>
                  </div>
                </div>
                <div className="thread-input">
                  <span>Create an issue from this conversation</span>
                  <div>＋ &nbsp; ☺ &nbsp; @ <b>↑</b></div>
                </div>
              </div>
            </div>
            
            <div id="feature-list-1">
              <div className="feature-footer">
                <span>Features</span>
                <div>
                  <details>
                    <summary>Continuous monitoring <span>+</span></summary>
                    <p>Papers are checked against Crossref upon upload and periodically thereafter.</p>
                  </details>
                  <details>
                    <summary>Clear status indicators <span>+</span></summary>
                    <p>Documents are marked as Active (no retraction found), Retracted, or Unknown.</p>
                  </details>
                  <details>
                    <summary>Metadata extraction <span>+</span></summary>
                    <p>Origyn identifies DOIs and queries authoritative registries automatically.</p>
                  </details>
                  <details>
                    <summary>Manual verification <span>+</span></summary>
                    <p>Review and verify sources that the system could not identify with certainty.</p>
                  </details>
                </div>
              </div>
            </div>
          </section>
          
          <section id="planning" className="section capability wrap">
            <div className="section-head reveal">
              <div>
                <span className="eyebrow"><i className="section-dot dot-2"></i> Extraction</span>
                <h2>Claim-level<br/>granularity</h2>
              </div>
              <div>
                <p>Break papers down into specific, attributable claims to track exactly which assertion informed an answer.</p>
                <Link className="text-link" href="#feature-list-2">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-panel planning-panel reveal">
              <span className="visual-caption">CLAIM EXTRACTION TIMELINE</span>
              <div className="timeline">
                <div className="months">
                  <span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span>
                </div>
                <div className="dates">
                  <span>2</span><span>9</span><span>16</span><span>23</span>
                  <span>2</span><span>9</span><span>16</span><span>23</span>
                  <span>2</span><span>9</span><span>16</span><span>23</span>
                  <span>2</span><span>9</span><span>16</span><span>23</span>
                  <span>2</span><span>9</span><span>16</span><span>23</span>
                  <span>2</span><span>9</span><span>16</span><span>23</span>
                </div>
                <div className="timeline-grid">
                  <div className="timeline-row">
                    <div className="timeline-title">◈ &nbsp; Source A</div>
                    <div className="timeline-bar bar-0">Claims Extracted <span>◇</span></div>
                  </div>
                  <div className="timeline-row">
                    <div className="timeline-title">◈ &nbsp; Source B</div>
                    <div className="timeline-bar bar-1">Pending Verification <span>◇</span></div>
                  </div>
                  <div className="timeline-row">
                    <div className="timeline-title">◈ &nbsp; Source C</div>
                    <div className="timeline-bar bar-2">Crossref Checked <span>◇</span></div>
                  </div>
                  <div className="timeline-row">
                    <div className="timeline-title">◈ &nbsp; Source D</div>
                    <div className="timeline-bar bar-3">Review Complete <span>◇</span></div>
                  </div>
                  <div className="today-marker">
                    <span>Today</span>
                  </div>
                </div>
              </div>
              
              <div className="chart-card">
                <div>Claims verified <small>↗</small></div>
                <svg viewBox="0 0 380 120" role="img" aria-label="Placeholder progress chart">
                  <defs>
                    <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop stopColor="#8980cd" stopOpacity=".25"/>
                      <stop offset="1" stopColor="#8980cd" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0 110L35 100L70 107L105 85L140 80L175 64L210 69L245 35L280 41L315 21L350 28L380 5V120H0Z" fill="url(#chart-fill)"/>
                  <path d="M0 110L35 100L70 107L105 85L140 80L175 64L210 69L245 35L280 41L315 21L350 28L380 5" stroke="#9990dd" fill="none" strokeWidth="2"/>
                </svg>
                <div className="chart-axis">
                  <span>Month 1</span><span>Month 2</span><span>Month 3</span>
                </div>
              </div>
            </div>
            
            <div id="feature-list-2">
              <div className="feature-footer">
                <span>Features</span>
                <div>
                  <details>
                    <summary>Atomic claims <span>+</span></summary>
                    <p>Documents are processed into distinct assertions for precise citation.</p>
                  </details>
                  <details>
                    <summary>Source linking <span>+</span></summary>
                    <p>Every claim retains a direct link to its source document and page number.</p>
                  </details>
                  <details>
                    <summary>Affected claim tracking <span>+</span></summary>
                    <p>If a source is retracted, all downstream claims are automatically flagged.</p>
                  </details>
                  <details>
                    <summary>Verification status <span>+</span></summary>
                    <p>Track the scholarly status of every assertion in your library.</p>
                  </details>
                  <details>
                    <summary>Context preservation <span>+</span></summary>
                    <p>Full quotes and surrounding context are stored alongside claims.</p>
                  </details>
                  <details>
                    <summary>Bulk processing <span>+</span></summary>
                    <p>Extract claims from multiple documents concurrently.</p>
                  </details>
                </div>
              </div>
            </div>
          </section>
          
          <section id="automation" className="section capability wrap">
            <div className="section-head reveal">
              <div>
                <span className="eyebrow"><i className="section-dot dot-3"></i> Provenance</span>
                <h2>Traceable<br/>answers</h2>
              </div>
              <div>
                <p>Ensure that generated text maintains a direct link back to the source document and its current scholarly status.</p>
                <Link className="text-link" href="#feature-list-3">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-panel automation-panel reveal">
              <span className="visual-caption">EVIDENCE-LOCKED GENERATION</span>
              <div className="agents-grid">
                <div className="agent-card">
                  <div className="agent-title">
                    <i className="agent-icon">◩</i><b>Summarizer</b><small>Bedrock</small>
                  </div>
                  <p>Synthesize literature while maintaining strict citation boundaries.</p>
                  <span className="context-label">◧ &nbsp; Source context</span>
                  <div className="agent-result">
                    <span className="muted">✦ &nbsp; Completed in 8 sec</span>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '73%'}}></div>
                    <div className="skeleton" style={{width: '83%'}}></div>
                    <div className="agent-item">◉ &nbsp; Citations mapped</div>
                  </div>
                </div>
                
                <div className="agent-card">
                  <div className="agent-title">
                    <i className="agent-icon">⌘</i><b>Graph Builder</b><small>Pipeline</small>
                  </div>
                  <p>Construct visual relationships between claims and final answers.</p>
                  <span className="context-label">◧ &nbsp; Lineage context</span>
                  <div className="agent-result">
                    <span className="muted">✦ &nbsp; Completed in 8 sec</span>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '73%'}}></div>
                    <div className="skeleton" style={{width: '83%'}}></div>
                    <div className="agent-item">◉ &nbsp; Edges connected</div>
                  </div>
                </div>
                
                <div className="agent-card">
                  <div className="agent-title">
                    <i className="agent-icon">✳</i><b>Monitor</b><small>Registry</small>
                  </div>
                  <p>Continuously check Crossref for changes to source validity.</p>
                  <span className="context-label">◧ &nbsp; Metadata context</span>
                  <div className="agent-result">
                    <span className="muted">✦ &nbsp; Completed in 8 sec</span>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '73%'}}></div>
                    <div className="skeleton" style={{width: '83%'}}></div>
                    <div className="agent-item">◉ &nbsp; Retraction check passed</div>
                  </div>
                </div>
              </div>
              
              <div className="automation-bottom">
                <span>✳</span>
                <div>
                  <b>Cryptographically linked</b>
                  <p>Answers cannot be generated without an unbroken chain of evidence.</p>
                </div>
                <span className="pill">Connected</span>
              </div>
            </div>
            
            <div id="feature-list-3">
              <div className="feature-footer">
                <span>Features</span>
                <div>
                  <details>
                    <summary>Evidence-locked generation <span>+</span></summary>
                    <p>The LLM is constrained to generating answers derived solely from extracted claims.</p>
                  </details>
                  <details>
                    <summary>Persistent lineage <span>+</span></summary>
                    <p>Database relationships maintain the link between answer, claim, and document.</p>
                  </details>
                  <details>
                    <summary>Alerts on invalidation <span>+</span></summary>
                    <p>Receive notifications if a source used in a previous answer is later retracted.</p>
                  </details>
                  <details>
                    <summary>Visual evidence graph <span>+</span></summary>
                    <p>Explore the connections between your library documents and final synthesis.</p>
                  </details>
                </div>
              </div>
            </div>
          </section>
          
          <section id="build" className="section capability wrap">
            <div className="section-head reveal">
              <div>
                <span className="eyebrow"><i className="section-dot dot-4"></i> Review</span>
                <h2>Inspect,<br/>review, and export</h2>
              </div>
              <div>
                <p>Audit the provenance of any generated output before relying on it in your research.</p>
                <Link className="text-link" href="#feature-list-4">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-panel build-panel reveal">
              <span className="visual-caption">EVIDENCE AUDIT LOG</span>
              
              <div className="issue-list">
                <div className="list-group">◕ &nbsp; In review <small>3</small></div>
                <div className="issue-row">
                  <span>▥</span><small>ANS-001</small><b>Summary of learning rates</b><span className="pill">Needs review</span><i className="avatar">A</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ANS-002</small><b>Methodology comparison</b><span className="pill">Needs review</span><i className="avatar">A</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ANS-003</small><b>Sample size analysis</b><span className="pill">Needs review</span><i className="avatar">A</i>
                </div>
                
                <div className="list-group">◌ &nbsp; In progress <small>4</small></div>
                <div className="issue-row">
                  <span>▥</span><small>ANS-004</small><b>Longitudinal trends</b><span className="pill">Working…</span><i className="avatar purple">B</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ANS-005</small><b>Cortical thickness data</b><span className="pill">Working…</span><i className="avatar purple">B</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ANS-006</small><b>Review generation</b><span className="pill">Working…</span><i className="avatar purple">B</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ANS-007</small><b>Claim extraction</b><span className="pill">Working…</span><i className="avatar purple">B</i>
                </div>
              </div>
              
              <div className="diff-window">
                <div className="thread-top">⑂ &nbsp; Review generated answer <span>+24 −8</span></div>
                <div className="diff-columns">
                  <div>
                    <div className="diff-line "><small>01</small><i style={{width: '52%'}}></i></div>
                    <div className="diff-line "><small>02</small><i style={{width: '76%'}}></i></div>
                    <div className="diff-line "><small>03</small><i style={{width: '60%'}}></i></div>
                    <div className="diff-line "><small>04</small><i style={{width: '40%'}}></i></div>
                    <div className="diff-line removed"><small>05</small><i style={{width: '67%'}}></i></div>
                    <div className="diff-line removed"><small>06</small><i style={{width: '46%'}}></i></div>
                    <div className="diff-line removed"><small>07</small><i style={{width: '71%'}}></i></div>
                    <div className="diff-line "><small>08</small><i style={{width: '37%'}}></i></div>
                    <div className="diff-line "><small>09</small><i style={{width: '54%'}}></i></div>
                  </div>
                  <div>
                    <div className="diff-line "><small>01</small><i style={{width: '52%'}}></i></div>
                    <div className="diff-line "><small>02</small><i style={{width: '76%'}}></i></div>
                    <div className="diff-line "><small>03</small><i style={{width: '60%'}}></i></div>
                    <div className="diff-line "><small>04</small><i style={{width: '40%'}}></i></div>
                    <div className="diff-line added"><small>05</small><i style={{width: '67%'}}></i></div>
                    <div className="diff-line added"><small>06</small><i style={{width: '46%'}}></i></div>
                    <div className="diff-line added"><small>07</small><i style={{width: '71%'}}></i></div>
                    <div className="diff-line "><small>08</small><i style={{width: '37%'}}></i></div>
                    <div className="diff-line "><small>09</small><i style={{width: '54%'}}></i></div>
                  </div>
                </div>
                <div className="review-footer">
                  <span>✓ &nbsp; Review complete</span><span className="pill">Approved</span>
                </div>
              </div>
            </div>
            
            <div id="feature-list-4">
              <div className="feature-footer">
                <span>Features</span>
                <div>
                  <details>
                    <summary>Source diffs <span>+</span></summary>
                    <p>Compare generated answers against the raw text of extracted claims.</p>
                  </details>
                  <details>
                    <summary>Validity checks <span>+</span></summary>
                    <p>Ensure no retracted papers have slipped into the final synthesis.</p>
                  </details>
                  <details>
                    <summary>Human approval <span>+</span></summary>
                    <p>Mark answers as verified before exporting them to external tools.</p>
                  </details>
                  <details>
                    <summary>Transparent export <span>+</span></summary>
                    <p>Export answers alongside a comprehensive bibliography of evidence.</p>
                  </details>
                  <details>
                    <summary>Audit logs <span>+</span></summary>
                    <p>Review the history of generation and source checks.</p>
                  </details>
                  <details>
                    <summary>API integration <span>+</span></summary>
                    <p>Connect the workspace to your existing institutional tools.</p>
                  </details>
                </div>
              </div>
            </div>
          </section>
          
          <section id="updates" className="section updates wrap">
            <div className="minor-heading">
              <h2>Latest updates</h2>
              <Link className="text-link" href="#update-1">View all →</Link>
            </div>
            <div className="updates-grid">
              <article id="update-1">
                <div className="update-visual update-1">
                  <div className="loop-diagram">
                    <span>◷</span><i></i><span>✳</span><i></i><span>✓</span>
                  </div>
                </div>
                <details className="update-detail">
                  <summary><h3>Crossref Integration Live</h3><span>↗</span></summary>
                  <p>Origyn now automatically checks the Crossref REST API for Retraction Watch metadata upon document upload.</p>
                </details>
                <p>Automated retraction monitoring is now available for all workspaces.</p>
                <time>SEP 17, 2026</time>
              </article>
              
              <article id="update-2">
                <div className="update-visual update-2">
                  <div className="inbox-mini">
                    <div>◈ &nbsp; Priority <span>3</span></div>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '65%'}}></div>
                    <div className="skeleton" style={{width: '75%'}}></div>
                  </div>
                </div>
                <details className="update-detail">
                  <summary><h3>Evidence Graph Preview</h3><span>↗</span></summary>
                  <p>Early access to the React Flow visualization of claims and answers.</p>
                </details>
                <p>Visualize the direct lineage from document to final synthesis.</p>
                <time>SEP 10, 2026</time>
              </article>
              
              <article id="update-3">
                <div className="update-visual update-3">
                  <div className="terminal-mini">
                    <span>● ● ●</span>
                    <div className="skeleton" style={{width: '75%'}}></div>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '60%'}}></div>
                  </div>
                </div>
                <details className="update-detail">
                  <summary><h3>API Documentation</h3><span>↗</span></summary>
                  <p>Integrate your internal institutional workflows via the Origyn API.</p>
                </details>
                <p>Documentation for programmatic document ingestion and status monitoring.</p>
                <time>AUG 28, 2026</time>
              </article>
            </div>
          </section>
          
          <section id="customers" className="section testimonials wrap">
            <div className="quotes reveal">
              <figure>
                <div className="quote-logo">❋ <span>Institute of Science</span></div>
                <blockquote>“Origyn provides the rigorous provenance tracking necessary to confidently use AI in our systematic reviews.”</blockquote>
                <figcaption>
                  <span>Lead Researcher</span>
                  <span>Cognitive Science Dept</span>
                </figcaption>
              </figure>
              <figure>
                <div className="quote-logo">◈ <span>Policy Lab</span></div>
                <blockquote>“Automating retraction checks directly into the synthesis pipeline ensures our briefings rely on current evidence.”</blockquote>
                <figcaption>
                  <span>Director</span>
                  <span>Research & Policy</span>
                </figcaption>
              </figure>
            </div>
            
            <div className="customer-bottom">
              <p><strong>Trusted by ambitious teams.</strong><br/>From emerging labs to global organizations.</p>
              <Link className="text-link" href="/workspace">Explore workspace →</Link>
            </div>
          </section>
          
          <section id="closing" className="closing wrap reveal">
            <h2 data-content="closing.title">Build your research<br/>on verifiable evidence.</h2>
            <div>
              <Link className="button" href="/workspace" data-content="closing.primary">Open workspace</Link>
              <Link className="button secondary" href="#intake" data-content="closing.secondary">Explore product</Link>
            </div>
          </section>
        </div>
      </main>
      
      <footer id="footer" className="wrap">
        <div className="footer-main">
          <Link className="brand footer-brand" href="#main" aria-label="Back to top">
            <i className="brand-mark" aria-hidden="true"></i>
            <span>Origyn</span>
          </Link>
          
          <div>
            <h3>Product</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
            <Link href="#updates">Updates</Link>
            <Link href="#customers">Customers</Link>
          </div>
          <div>
            <h3>Features</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
            <Link href="#updates">Updates</Link>
            <Link href="#customers">Customers</Link>
          </div>
          <div>
            <h3>Company</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
            <Link href="#updates">Updates</Link>
            <Link href="#customers">Customers</Link>
          </div>
          <div>
            <h3>Resources</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
            <Link href="#updates">Updates</Link>
            <Link href="#customers">Customers</Link>
          </div>
          <div>
            <h3>Connect</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
          </div>
        </div>
        
        <div className="footer-bottom">
          <span data-content="footer.copyright">© {new Date().getFullYear()} Origyn. Not a substitute for scientific judgement.</span>
          <div>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Legal</span>
          </div>
          <a href="#main">Back to top ↑</a>
        </div>
      </footer>
    </>
  );
}
