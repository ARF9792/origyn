import React from 'react';
import Link from 'next/link';
import ParticleWave from '@/components/landing/ParticleWave';
import LandingMotion from "@/components/landing/LandingMotion";
import Image from "next/image";
export default function LandingPage() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <ParticleWave />
      <LandingMotion />
      <header className="header">
  <nav className="nav wrap" aria-label="Main navigation">

    <Link
  className="brand brand-logo-link"
  href="#main"
  aria-label="Origyn home"
>
  <span className="brand-logo-frame">
    <Image
      src="/origyn-logo.png"
      alt="Origyn"
      fill
      priority
      sizes="180px"
      className="brand-logo-image"
    />
  </span>
</Link>

    <div className="nav-actions">
      <Link
        className="nav-contact"
        href="#why-origyn"
      >
        Why Origyn
      </Link>

      <Link
        className="nav-login"
        href="#overview"
      >
        Explore
      </Link>

      <Link
        className="nav-workspace"
        href="/workspace"
      >
        Open workspace
      </Link>
    </div>

  </nav>
</header>
      
      <main id="main">
        <section className="hero wrap">
          <h1 data-content="hero.title">Evidence memory layer,<br/>from paper to claim to answer.</h1>
          <div className="hero-sub">
            <p data-content="hero.description">Explore PDF sources, extracted claims, and answers with their evidence trail visible in one workspace.</p>
            <Link className="text-link" href="/workspace/graph">
              <strong>Explore</strong> &nbsp; Evidence graph <span>→</span>
            </Link>
          </div>
          
          <div className="product-window hero-window" role="img" aria-label="Illustrative Origyn evidence workspace preview">
            <aside className="demo-sidebar">
              <b>◩ &nbsp; Workspace <span>⌄</span></b>
              <div>⌁ &nbsp; Overview</div>
              <div>▧ &nbsp; Sources</div>
              <div>◌ &nbsp; Chat</div>
              <div>⑂ &nbsp; Alerts</div>
              <label>Evidence</label>
              <div>◈ &nbsp; Claims</div>
              <div>▦ &nbsp; Graph</div>
              <label>Workspace</label>
              <div className="selected">◧ &nbsp; Neuroplasticity review</div>
              <div>◇ &nbsp; Source detail</div>
              <div>▥ &nbsp; Impact</div>
            </aside>
            <div className="issue">
              <div className="window-toolbar">
                <span><i className="status yellow"></i> DOC-001 &nbsp; Sleep-dependent consolidation &nbsp; <span className="star">✦</span></span>
                <span>··· <span className="muted">&nbsp; 1 / 12</span></span>
              </div>
              <div className="issue-body">
                <div className="issue-main">
                  <h3>Neuroplasticity literature review</h3>
                  <p>Evidence and provenance for your ongoing cognitive science literature review.<br/>Includes 12 example source records.</p>
                  
                  <h4>Activity <span>···</span></h4>
                  
                  <div className="activity">
                    <i className="avatar">A</i>
                    <div>
                      <b>System</b> <small>· 2 min ago</small>
                      <p>12 illustrative source records are available for review.</p>
                    </div>
                  </div>
                  
                  <div className="activity">
                    <i className="avatar purple">B</i>
                    <div>
                      <b>Origyn</b> <small>· just now</small>
                      <p>An answer can be inspected through its sources and claims.</p>
                      <div className="agent-response">
                        <span>◩ &nbsp; Evidence <small>· inspectable</small></span>
                        <div className="skeleton long"></div>
                        <div className="skeleton"></div>
                        <div className="code-status">⑂ &nbsp; Answer evidence available <span>3 claims</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <aside className="properties">
                  <h4>Properties</h4>
                  <p>◕ &nbsp; No retraction found</p>
                  <p>▥ &nbsp; Last checked</p>
                  <p>◉ &nbsp; Authors</p>
                  <p>◩ &nbsp; DOI</p>
                  
                  <h4>Evidence</h4>
                  <span className="pill">Neuroscience</span>
                  <span className="pill">Source</span>
                  
                  <h4>Workspace</h4>
                  <p>◧ &nbsp; Neuroplasticity review</p>
                </aside>
              </div>
            </div>
          </div>
        </section>
        
        <div id="sections">
          <section className="customers-strip wrap reveal">
            <p>EXPLORE THE EVIDENCE WORKFLOW</p>
            <div className="logos">
              <span>◈ <b>Source library</b></span>
              <span>▰ <b>Claim review</b></span>
              <span>❋ <b>Evidence chat</b></span>
              <span>◒ <b>Evidence graph</b></span>
              <span>⌘ <b>Impact review</b></span>
              <span>✦ <b>Answer history</b></span>
            </div>
          </section>
          
          <section id="overview" className="overview wrap section">
            <h2 className="statement reveal">
              <span>A new standard for evidence tracking.</span> Explore how source status, extracted claims, and answer history connect in one research workspace.
            </h2>
            <div className="principles reveal">
              <article>
                <div className="figure">
                  <small>FIG 0.1</small>
                  <div className="mini-layers">
                    <div>◈ &nbsp; Metadata extracted</div>
                    <div>▧ &nbsp; DOI identified</div>
                    <div>◌ &nbsp; Status recorded</div>
                  </div>
                </div>
                <h3>Visible source status</h3>
                <p>Inspect each source’s identity, DOI, last check, and recorded retraction status.</p>
              </article>
              
              <article>
                <div className="figure">
                  <small>FIG 0.2</small>
                  <div className="mini-network">
                    <span>◈</span><i></i><b>✳</b><i></i><span>⌘</span>
                  </div>
                </div>
                <h3>Claim extraction</h3>
                <p>Inspect source-linked claims and see which answers used them.</p>
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
                <p>See the claims and source records behind each workspace answer.</p>
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
                <p>The source library lets you filter papers by identification and retraction status, with details available for review.</p>
                <Link className="text-link" href="/workspace">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-board visual-panel reveal">
              <span className="visual-caption">SOURCE STATUS ILLUSTRATION</span>
              <div className="kanban">
                <div className="kanban-col">
                  <div className="column-label"><i className="status "></i>No retraction found<span>8</span></div>
                  <div className="task-card">
                    <small>DOC-001</small>
                    <p>Sleep-dependent consolidation</p>
                    <div>
                      <span className="pill">No retraction found</span><i className="avatar">A</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-005</small>
                    <p>The role of rest in skill acquisition</p>
                    <div>
                      <span className="pill">No retraction found</span><i className="avatar">B</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-006</small>
                    <p>Experience-dependent connectivity</p>
                    <div>
                      <span className="pill">No retraction found</span><i className="avatar">C</i>
                    </div>
                  </div>
                </div>
                
                <div className="kanban-col">
                  <div className="column-label"><i className="status "></i>Processing<span>1</span></div>
                  <div className="task-card">
                    <small>DOC-004</small>
                    <p>Sensorimotor lifespan</p>
                    <div>
                      <span className="pill">Processing</span><i className="avatar">D</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>STAGE-02</small>
                    <p>Identify scholarly metadata</p>
                    <div>
                      <span className="pill">Processing</span><i className="avatar">E</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>STAGE-03</small>
                    <p>Prepare source record</p>
                    <div>
                      <span className="pill">Processing</span><i className="avatar">F</i>
                    </div>
                  </div>
                </div>
                
                <div className="kanban-col">
                  <div className="column-label"><i className="status yellow"></i>Needs review<span>3</span></div>
                  <div className="task-card">
                    <small>DOC-002</small>
                    <p>Repeated cognitive training</p>
                    <div>
                      <span className="pill">Retracted</span><i className="avatar">G</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-003</small>
                    <p>Longitudinal markers</p>
                    <div>
                      <span className="pill">Unable to verify</span><i className="avatar">H</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>DOC-010</small>
                    <p>Adaptive working-memory protocol</p>
                    <div>
                      <span className="pill">Unable to verify</span><i className="avatar">I</i>
                    </div>
                  </div>
                </div>
                
                <div className="kanban-col">
                  <div className="column-label"><i className="status "></i>Impact<span>3</span></div>
                  <div className="task-card">
                    <small>DOC-002</small>
                    <p>Retracted source</p>
                    <div>
                      <span className="pill">Retracted</span><i className="avatar">J</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>CL-021</small>
                    <p>Affected claim</p>
                    <div>
                      <span className="pill">Affected</span><i className="avatar">K</i>
                    </div>
                  </div>
                  <div className="task-card">
                    <small>ans_history_1</small>
                    <p>Historical answer</p>
                    <div>
                      <span className="pill">Evidence changed</span><i className="avatar">L</i>
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
                    <p>A source status changed: DOC-002 is retracted in this example.</p>
                  </div>
                </div>
                <div className="activity">
                  <i className="avatar purple">B</i>
                  <div>
                    <b>Researcher</b><small> &nbsp; 12:35</small>
                    <p>The affected claim and historical answer remain visible for review.</p>
                  </div>
                </div>
                <div className="thread-input">
                  <span>Inspect the affected evidence path</span>
                  <div>＋ &nbsp; ☺ &nbsp; @ <b>↑</b></div>
                </div>
              </div>
            </div>
            
            <div id="feature-list-1">
              <div className="feature-footer">
                <span>Features</span>
                <div>
                  <details>
                    <summary>Source status review <span>+</span></summary>
                    <p>See when a source was last checked and review a source again when needed.</p>
                  </details>
                  <details>
                    <summary>Clear status indicators <span>+</span></summary>
                    <p>Sources show No retraction found, Retracted, Unable to verify, or Processing.</p>
                  </details>
                  <details>
                    <summary>Metadata extraction <span>+</span></summary>
                    <p>The upload flow displays extracted metadata, DOI identification, and the status-check stage.</p>
                  </details>
                  <details>
                    <summary>Sources needing review <span>+</span></summary>
                    <p>Open sources marked Unable to verify and inspect the available metadata.</p>
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
                <p>Inspect source-linked claims and see which answers used them.</p>
                <Link className="text-link" href="#feature-list-2">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-panel planning-panel reveal">
              <span className="visual-caption">CLAIM LINEAGE ILLUSTRATION</span>
              <div className="timeline">
                <div className="months">
                  <span>SRC</span><span>CLM</span><span>ANS</span><span>IMP</span><span>REV</span><span>NOW</span>
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
                    <div className="timeline-title">◈ &nbsp; Source DOC-001</div>
                    <div className="timeline-bar bar-0">Claims Extracted <span>◇</span></div>
                  </div>
                  <div className="timeline-row">
                    <div className="timeline-title">◈ &nbsp; Source DOC-002</div>
                    <div className="timeline-bar bar-1">Pending Verification <span>◇</span></div>
                  </div>
                  <div className="timeline-row">
                    <div className="timeline-title">◈ &nbsp; Source DOC-003</div>
                    <div className="timeline-bar bar-2">Status recorded <span>◇</span></div>
                  </div>
                  <div className="timeline-row">
                    <div className="timeline-title">◈ &nbsp; Source DOC-006</div>
                    <div className="timeline-bar bar-3">Evidence linked <span>◇</span></div>
                  </div>
                  <div className="today-marker">
                    <span>Today</span>
                  </div>
                </div>
              </div>
              
              <div className="chart-card">
                <div>Claims linked <small>↗</small></div>
                <svg viewBox="0 0 380 120" role="img" aria-label="Illustrative claim lineage chart">
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
                  <span>Sources</span><span>Claims</span><span>Answers</span>
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
                    <p>Claims link to their source record; excerpts and page references appear when available.</p>
                  </details>
                  <details>
                    <summary>Affected claim tracking <span>+</span></summary>
                    <p>Affected claims remain visible when their supporting source becomes retracted.</p>
                  </details>
                  <details>
                    <summary>Verification status <span>+</span></summary>
                    <p>See whether each claim is supported by current workspace sources or needs review.</p>
                  </details>
                  <details>
                    <summary>Context preservation <span>+</span></summary>
                    <p>Inspect claim text, source identity, and any excerpt available in the workspace.</p>
                  </details>
                  <details>
                    <summary>Claim search and filters <span>+</span></summary>
                    <p>Search claims by text, source, or status, and filter by review state.</p>
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
                <p>Inspect the sources and claims cited by an answer, alongside their current evidence status.</p>
                <Link className="text-link" href="#feature-list-3">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-panel automation-panel reveal">
              <span className="visual-caption">ANSWER EVIDENCE PREVIEW</span>
              <div className="agents-grid">
                <div className="agent-card">
                  <div className="agent-title">
                    <i className="agent-icon">◩</i><b>Evidence chat</b><small>Workspace</small>
                  </div>
                  <p>Review an answer together with the claims and sources it cites.</p>
                  <span className="context-label">◧ &nbsp; Source context</span>
                  <div className="agent-result">
                    <span className="muted">◷ &nbsp; Workspace example</span>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '73%'}}></div>
                    <div className="skeleton" style={{width: '83%'}}></div>
                    <div className="agent-item">◉ &nbsp; Sources and claims shown</div>
                  </div>
                </div>
                
                <div className="agent-card">
                  <div className="agent-title">
                    <i className="agent-icon">⌘</i><b>Evidence graph</b><small>Lineage</small>
                  </div>
                  <p>Explore document, claim, and answer relationships.</p>
                  <span className="context-label">◧ &nbsp; Lineage context</span>
                  <div className="agent-result">
                    <span className="muted">◷ &nbsp; Workspace example</span>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '73%'}}></div>
                    <div className="skeleton" style={{width: '83%'}}></div>
                    <div className="agent-item">◉ &nbsp; Lineage visible</div>
                  </div>
                </div>
                
                <div className="agent-card">
                  <div className="agent-title">
                    <i className="agent-icon">✳</i><b>Impact review</b><small>Source</small>
                  </div>
                  <p>Inspect the downstream impact when a source status changes.</p>
                  <span className="context-label">◧ &nbsp; Metadata context</span>
                  <div className="agent-result">
                    <span className="muted">◷ &nbsp; Workspace example</span>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '73%'}}></div>
                    <div className="skeleton" style={{width: '83%'}}></div>
                    <div className="agent-item">◉ &nbsp; No retraction found</div>
                  </div>
                </div>
              </div>
              
              <div className="automation-bottom">
                <span>✳</span>
                <div>
                  <b>Evidence linked</b>
                  <p>Trace the recorded path from source to claim to answer.</p>
                </div>
                <span className="pill">Traceable</span>
              </div>
            </div>
            
            <div id="feature-list-3">
              <div className="feature-footer">
                <span>Features</span>
                <div>
                  <details>
                    <summary>Evidence-locked generation <span>+</span></summary>
                    <p>Evidence-Locked Chat uses currently usable workspace claims and shows the sources cited in each answer.</p>
                  </details>
                  <details>
                    <summary>Persistent lineage <span>+</span></summary>
                    <p>Source, claim, and answer references remain inspectable in the workspace.</p>
                  </details>
                  <details>
                    <summary>Alerts on invalidation <span>+</span></summary>
                    <p>The Alerts view summarizes evidence changes and links to affected historical answers.</p>
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
                <h2>Inspect,<br/>review, and trace</h2>
              </div>
              <div>
                <p>Audit the provenance of any generated output before relying on it in your research.</p>
                <Link className="text-link" href="#feature-list-4">Explore feature <span>→</span></Link>
              </div>
            </div>
            
            <div className="visual-panel build-panel reveal">
              <span className="visual-caption">ANSWER HISTORY ILLUSTRATION</span>
              
              <div className="issue-list">
                <div className="list-group">◕ &nbsp; Answer states <small>3</small></div>
                <div className="issue-row">
                  <span>▥</span><small>STATE-01</small><b>Historical answer</b><span className="pill">Evidence changed</span><i className="avatar">A</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>STATE-02</small><b>Updated answer</b><span className="pill">Current</span><i className="avatar">A</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>STATE-03</small><b>Current answer</b><span className="pill">Current</span><i className="avatar">A</i>
                </div>
                
                <div className="list-group">◌ &nbsp; Evidence actions <small>4</small></div>
                <div className="issue-row">
                  <span>▥</span><small>ACTION-01</small><b>Inspect source</b><span className="pill">Available</span><i className="avatar purple">B</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ACTION-02</small><b>Review claim</b><span className="pill">Available</span><i className="avatar purple">B</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ACTION-03</small><b>Focus graph path</b><span className="pill">Available</span><i className="avatar purple">B</i>
                </div>
                <div className="issue-row">
                  <span>▥</span><small>ACTION-04</small><b>Open affected answer</b><span className="pill">Available</span><i className="avatar purple">B</i>
                </div>
              </div>
              
              <div className="diff-window">
                <div className="thread-top">⑂ &nbsp; Review answer evidence <span>1 source changed</span></div>
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
                  <span>✓ &nbsp; Original retained</span><span className="pill">Inspectable</span>
                </div>
              </div>
            </div>
            
            <div id="feature-list-4">
              <div className="feature-footer">
                <span>Features</span>
                <div>
                  <details>
                    <summary>Answer evidence <span>+</span></summary>
                    <p>Open an answer’s evidence panel to inspect its cited claims and source excerpts.</p>
                  </details>
                  <details>
                    <summary>Current evidence context <span>+</span></summary>
                    <p>Retracted sources are excluded from new current-evidence answers.</p>
                  </details>
                  <details>
                    <summary>Historical answers <span>+</span></summary>
                    <p>Keep the original answer visible when evidence later changes.</p>
                  </details>
                  <details>
                    <summary>Updated answer versions <span>+</span></summary>
                    <p>Generate a new version from remaining evidence while preserving the earlier answer.</p>
                  </details>
                  <details>
                    <summary>Impact inspection <span>+</span></summary>
                    <p>Review which claims and answers depend on a changed source.</p>
                  </details>
                  <details>
                    <summary>Connected navigation <span>+</span></summary>
                    <p>Move between sources, claims, graph, alerts, and the exact answer in Chat.</p>
                  </details>
                </div>
              </div>
            </div>
          </section>
          
          <section id="updates" className="section updates wrap">
            <div className="minor-heading">
              <h2>Explore the workflow</h2>
              <Link className="text-link" href="/workspace">Open workspace →</Link>
            </div>
            <div className="updates-grid">
              <article id="update-1">
                <div className="update-visual update-1">
                  <div className="loop-diagram">
                    <span>◷</span><i></i><span>✳</span><i></i><span>✓</span>
                  </div>
                </div>
                <details className="update-detail">
                  <summary><h3>Source status review</h3><span>↗</span></summary>
                  <p>Inspect source identity, DOI, recorded status, and last-check details.</p>
                </details>
                <p>Review a source and trace any downstream impact.</p>
                <time>SOURCE</time>
              </article>
              
              <article id="update-2">
                <div className="update-visual update-2">
                  <div className="inbox-mini">
                    <div>◈ &nbsp; Evidence changes <span>3</span></div>
                    <div className="skeleton" style={{width: '90%'}}></div>
                    <div className="skeleton" style={{width: '65%'}}></div>
                    <div className="skeleton" style={{width: '75%'}}></div>
                  </div>
                </div>
                <details className="update-detail">
                  <summary><h3>Evidence graph</h3><span>↗</span></summary>
                  <p>Explore the recorded document → claim → answer lineage.</p>
                </details>
                <p>Focus a source to see the affected path through claims and answers.</p>
                <time>CLAIM</time>
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
                  <summary><h3>Answer history</h3><span>↗</span></summary>
                  <p>Inspect the original answer, its evidence, and any updated version.</p>
                </details>
                <p>Evidence changes remain visible without rewriting past answers.</p>
                <time>ANSWER</time>
              </article>
            </div>
          </section>
          
          <section id="why-origyn" className="section why-origyn wrap">
  <div className="why-origyn-head reveal">
    <span className="eyebrow">
      Why Origyn
    </span>

    <h2>
      AI answers should come
      <br />
      with their evidence.
    </h2>

    <p>
      Origyn keeps the path from source to claim to generated
      answer visible, so changes in the underlying evidence can
      be traced downstream.
    </p>
  </div>

  <div className="why-grid reveal">

    <article className="why-card">
      <span className="why-number">01</span>

      <div className="why-preview" aria-label="Illustration of a source record">
        <div className="why-preview-bar"><span>Sources / doc_002</span><span>Record</span></div>
        <div className="why-preview-content">
          <span className="why-preview-label">SOURCE RECORD</span>
          <strong>Neural adaptation following repeated cognitive training</strong>
          <div className="why-preview-rule" />
          <div className="why-preview-bottom"><span className="why-preview-status is-retracted">Retracted</span><span>DOI available</span></div>
        </div>
      </div>

      <h3>
        Know the source
      </h3>

      <p>
        Uploaded documents retain their metadata, status,
        and provenance instead of becoming anonymous chunks
        inside a retrieval pipeline.
      </p>
    </article>


    <article className="why-card">
      <span className="why-number">02</span>

      <div className="why-preview" aria-label="Illustration of an extracted claim">
        <div className="why-preview-bar"><span>Claims / CL-021</span><span>Evidence</span></div>
        <div className="why-preview-content">
          <span className="why-preview-label">EXTRACTED CLAIM</span>
          <strong>Repeated training was associated with changes in task performance.</strong>
          <div className="why-preview-rule" />
          <div className="why-preview-bottom"><span className="why-preview-status is-affected">Affected</span><span>From doc_002</span></div>
        </div>
      </div>

      <h3>
        Trace the claim
      </h3>

      <p>
        Extracted claims remain connected to the documents
        they came from, making the evidence behind an answer
        inspectable.
      </p>
    </article>


    <article className="why-card">
      <span className="why-number">03</span>

      <div className="why-preview" aria-label="Illustration of an answer with changed evidence">
        <div className="why-preview-bar"><span>Chat / Answer history</span><span>Version 01</span></div>
        <div className="why-preview-content">
          <span className="why-preview-label">HISTORICAL ANSWER</span>
          <strong>What does the evidence say about repeated cognitive training?</strong>
          <div className="why-preview-rule" />
          <div className="why-preview-bottom"><span className="why-preview-status is-changed">Evidence changed</span><span>1 claim affected</span></div>
        </div>
      </div>

      <h3>
        See what changes
      </h3>

      <p>
        When a source becomes unusable or its evidence status
        changes, Origyn can identify the claims and answers that
        depended on it.
      </p>
    </article>

  </div>

  <div className="why-footer reveal">
    <p>
      Document
      <span>→</span>
      Claim
      <span>→</span>
      AI Answer
    </p>

    <Link
      className="text-link"
      href="/workspace"
    >
      Explore the workspace →
    </Link>
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
            <Link href="#updates">Workflow</Link>
            <Link href="#why-origyn">Why Origyn</Link>
          </div>
          <div>
            <h3>Features</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
            <Link href="#updates">Workflow</Link>
            <Link href="#why-origyn">Why Origyn</Link>
          </div>
          <div>
            <h3>Origyn</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
            <Link href="#updates">Workflow</Link>
            <Link href="#why-origyn">Why Origyn</Link>
          </div>
          <div>
            <h3>Research</h3>
            <Link href="/workspace">Workspace</Link>
            <Link href="#planning">Extraction</Link>
            <Link href="#automation">Provenance</Link>
            <Link href="#build">Review</Link>
            <Link href="#updates">Workflow</Link>
            <Link href="#why-origyn">Why Origyn</Link>
          </div>
          <div>
            <h3>Navigate</h3>
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
