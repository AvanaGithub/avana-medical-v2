(function(){
  /* Set CAREERS_ENDPOINT to the form/email service once it is ready. It should
     (1) email the applicant from noreply@avanamedical.com using careers-email.html with OPEN_POSITIONS_URL, and
     (2) pass the details on to Avana HR. Until it is set, the form shows the confirmation without sending. */
  var CAREERS_ENDPOINT='';
  var OPEN_POSITIONS_URL='https://avanamedical.zohorecruit.in/';
  var ov=document.getElementById('careersModal'),panel=ov.querySelector('.cm-panel'),form=document.getElementById('cmForm'),
      done=document.getElementById('cmDone'),trig=document.getElementById('openPosBtn'),sub=document.getElementById('cmSubmit'),
      ferr=document.getElementById('cmFormErr'),why=document.getElementById('cm-why'),whyN=document.getElementById('cm-why-n'),last=null;
  function focusables(){return [].slice.call(panel.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(function(e){return !e.disabled&&e.offsetParent!==null})}
  function openM(){last=document.activeElement;form.reset();whyN.textContent='0';clearErr();form.hidden=false;done.hidden=true;sub.disabled=false;sub.textContent='Send me the link';
    ov.hidden=false;document.documentElement.classList.add('cm-lock');requestAnimationFrame(function(){ov.classList.add('open')});
    setTimeout(function(){document.getElementById('cm-name').focus()},60)}
  function closeM(){ov.classList.remove('open');document.documentElement.classList.remove('cm-lock');setTimeout(function(){ov.hidden=true},220);if(last&&last.focus)last.focus()}
  trig&&trig.addEventListener('click',openM);
  ['cmClose','cmCancel','cmDoneClose'].forEach(function(id){document.getElementById(id).addEventListener('click',closeM)});
  ov.addEventListener('mousedown',function(e){if(e.target===ov)closeM()});
  ov.addEventListener('keydown',function(e){
    if(e.key==='Escape'){e.preventDefault();closeM();return}
    if(e.key==='Tab'){var f=focusables();if(!f.length)return;var a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
  });
  why.addEventListener('input',function(){whyN.textContent=why.value.length});
  function setErr(id,msg){var el=document.getElementById(id),er=document.getElementById(id+'-e');el.setAttribute('aria-invalid',msg?'true':'false');
    if(msg)el.setAttribute('aria-describedby',id+'-e');else el.removeAttribute('aria-describedby');er.textContent=msg||''}
  function clearErr(){['cm-name','cm-email','cm-age','cm-marital','cm-edu','cm-consent'].forEach(function(i){setErr(i,'')});ferr.textContent=''}
  function validate(){
    var v=function(id){return document.getElementById(id).value.trim()},bad=[];
    var name=v('cm-name'),email=v('cm-email'),age=v('cm-age'),mar=v('cm-marital'),edu=v('cm-edu'),ok=document.getElementById('cm-consent').checked;
    function chk(id,msg){setErr(id,msg);if(msg)bad.push(id)}
    chk('cm-name',name.length<2?'Please enter your full name.':'');
    chk('cm-email',!email?'Please enter your email address.':(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)?'Please enter a valid email address, like name@example.com.':''));
    var n=Number(age);chk('cm-age',!age?'Please enter your age.':(!Number.isInteger(n)||n<18||n>65?'Please enter an age between 18 and 65.':''));
    chk('cm-marital',!mar?'Please choose an option.':'');
    chk('cm-edu',edu.length<2?'Please enter your highest qualification.':'');
    chk('cm-consent',!ok?'Please agree so we can contact you.':'');
    if(bad.length){document.getElementById(bad[0]).focus();return null}
    return {name:name,email:email,age:n,marital_status:mar,education:edu,why_join:why.value.trim(),consent:true,
            open_positions_url:OPEN_POSITIONS_URL,reply_from:'noreply@avanamedical.com',submitted_at:new Date().toISOString(),source:'avanamedical.com careers'};
  }
  function success(d){form.hidden=true;done.hidden=false;document.getElementById('cmDoneName').textContent=d.name.split(' ')[0];
    document.getElementById('cmDoneEmail').textContent=d.email;done.focus()}
  form.addEventListener('submit',function(e){
    e.preventDefault();ferr.textContent='';var d=validate();if(!d)return;
    sub.disabled=true;sub.textContent='Sending…';
    if(!CAREERS_ENDPOINT){setTimeout(function(){success(d)},600);return}
    fetch(CAREERS_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})
      .then(function(r){if(!r.ok)throw new Error(r.status);success(d)})
      .catch(function(){sub.disabled=false;sub.textContent='Send me the link';
        ferr.textContent='We couldn\'t send your request just now. Please try again, or write to us at info@avanamedical.com.'});
  });
})();
