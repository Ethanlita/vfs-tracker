/** @file 实时音频采集和播放；重 DSP 留在 Worker，输入和输出队列有固定上限。 */
// Light audio-thread I/O only. Stateful WSOLA/FIR processing runs in a Worker.
class LivePitchIO extends AudioWorkletProcessor {
  constructor({processorOptions:options={}}) {
    super();
    this.chunkFrames=512;
    this.chunk=new Float32Array(this.chunkFrames);this.used=0;
    this.capacity=Math.ceil(sampleRate*.4);
    this.ring=new Float32Array(this.capacity);this.read=0;this.write=0;this.queued=0;
    this.inputLimitFrames=Math.ceil(sampleRate*.15);
    this.holdFrames=Math.ceil(sampleRate*.035);
    this.epoch=0;this.desiredPitch=options.semitones??7;this.currentPitch=null;
    this.link=null;this.ready=false;this.transitioning=false;this.waitingReady=true;this.running=true;
    this.inFlight=0;this.playing=false;this.primeAt=null;this.phase='connecting';
    this.frames=0;this.inputFrames=0;this.playedFrames=0;this.generatedFrames=0;
    this.underruns=0;this.overruns=0;this.overloads=0;this.droppedInputFrames=0;this.discardedOutputFrames=0;
    this.fadeOut=0;this.fadeStart=0;this.fadeIn=0;this.last=0;
    this.inputRms=0;this.outputRms=0;this.lastStats=0;this.processingMs=0;
    this.previewIn=new Float32Array(128);this.previewOut=new Float32Array(128);this.config=null;
    this.port.onmessage=({data})=>{
      if(data.type==='connect' && !this.link) {
        this.link=data.port;this.link.onmessage=event=>this.fromWorker(event.data);this.link.start();
      } else if(data.type==='pitch' && Number.isFinite(data.semitones) && data.semitones>=-19 && data.semitones<=20) {
        this.desiredPitch=data.semitones;
        if(this.ready && this.currentPitch!==this.desiredPitch)this.beginTransition('reconfiguring');
      } else if(data.type==='stop') {
        this.running=false;this.clearPlayback();
        this.link?.postMessage({type:'stop',epoch:this.epoch});this.link?.close();this.link=null;
      }
    };
  }
  clearPlayback() {
    this.discardedOutputFrames+=this.queued;
    this.read=0;this.write=0;this.queued=0;this.playing=false;this.primeAt=null;
    this.fadeOut=64;this.fadeStart=this.last;this.fadeIn=0;
  }
  beginTransition(reason) {
    if(!this.transitioning){this.clearPlayback();this.used=0;}
    this.transitioning=true;this.phase=reason;this.maybeReset();
  }
  maybeReset() {
    // Drain at most 150 ms of already submitted input before resetting.
    // Never create another epoch just to bypass the backpressure limit.
    if(!this.transitioning || this.inFlight || !this.ready || this.waitingReady || !this.link)return;
    this.epoch++;this.waitingReady=true;this.ready=false;
    this.link.postMessage({type:'pitch',epoch:this.epoch,semitones:this.desiredPitch});
  }
  fromWorker(data) {
    if(!this.running || data.epoch!==this.epoch)return;
    if(data.type==='ready') {
      this.ready=true;this.waitingReady=false;this.config=data.stats;this.currentPitch=data.semitones;
      if(this.desiredPitch!==this.currentPitch){this.beginTransition('reconfiguring');return;}
      this.transitioning=false;this.phase='buffering';
      this.port.postMessage({type:'config',stats:data.stats,chunkFrames:this.chunkFrames,holdMs:35});
    } else if(data.type==='ack') {
      this.inFlight=Math.max(0,this.inFlight-data.frames);this.processingMs+=data.processingMs;
      this.maybeReset();
    } else if(data.type==='output' && !this.transitioning) {
      let samples=data.samples;
      this.generatedFrames+=samples.length;
      if(samples.length>this.capacity) {
        this.discardedOutputFrames+=samples.length-this.capacity;samples=samples.subarray(samples.length-this.capacity);
      }
      if(this.queued+samples.length>this.capacity) {
        // Drop old playback, not an ever-growing delay, if the device stalls.
        const drop=this.queued+samples.length-this.capacity;
        this.read=(this.read+drop)%this.capacity;this.queued-=drop;
        this.discardedOutputFrames+=drop;this.overruns++;this.fadeIn=64;
      }
      for(let i=0;i<samples.length;i++){this.ring[this.write]=samples[i];this.write=(this.write+1)%this.capacity;}
      this.queued+=samples.length;
      if(!this.playing && this.primeAt===null)this.primeAt=this.frames+this.holdFrames;
    } else if(data.type==='error')this.port.postMessage({type:'error',message:data.message});
  }
  capture(input) {
    this.inputFrames+=input.length;
    let energy=0;for(let i=0;i<input.length;i++)energy+=input[i]*input[i];
    this.inputRms=Math.sqrt(energy/input.length);
    const stride=Math.max(1,input.length/this.previewIn.length);
    for(let i=0;i<this.previewIn.length;i++)this.previewIn[i]=input[Math.min(input.length-1,Math.floor(i*stride))];
    if(!this.ready || this.transitioning || !this.link){this.droppedInputFrames+=input.length;return;}
    for(let i=0;i<input.length;i++) {
      this.chunk[this.used++]=input[i];
      if(this.used!==this.chunkFrames)continue;
      this.used=0;
      if(this.inFlight+this.chunkFrames>this.inputLimitFrames) {
        this.overloads++;this.droppedInputFrames+=this.chunkFrames+(input.length-i-1);
        this.beginTransition('catching-up');return;
      }
      const samples=this.chunk.slice();
      this.inFlight+=samples.length;
      this.link.postMessage({type:'input',epoch:this.epoch,samples},[samples.buffer]);
    }
  }
  process(inputs,outputs) {
    const output=outputs[0]?.[0];
    if(!output)return this.running;
    if(!this.running){output.fill(0);return false;}
    const input=inputs[0]?.[0];if(input?.length)this.capture(input);
    if(!this.playing && !this.transitioning && this.queued>=output.length && this.primeAt!==null && this.frames>=this.primeAt) {
      this.playing=true;this.phase='playing';this.fadeIn=64;this.fadeOut=0;
    }
    let energy=0;
    for(let i=0;i<output.length;i++) {
      let value=0;
      if(this.playing) {
        if(this.queued) {
          value=this.ring[this.read];this.read=(this.read+1)%this.capacity;this.queued--;this.playedFrames++;
          if(this.fadeIn){value*=1-this.fadeIn/64;this.fadeIn--;}
        } else {
          this.underruns++;this.playing=false;this.primeAt=null;this.phase='buffering';
          this.fadeStart=this.last;this.fadeOut=64;
        }
      }
      if(!this.playing && this.fadeOut){value=this.fadeStart*this.fadeOut/64;this.fadeOut--;}
      this.last=value;output[i]=value;energy+=value*value;
    }
    this.outputRms=Math.sqrt(energy/output.length);
    for(let i=0;i<this.previewOut.length;i++)this.previewOut[i]=output[Math.min(output.length-1,Math.floor(i*output.length/this.previewOut.length))];
    this.frames+=output.length;
    if(this.frames-this.lastStats>=sampleRate*.25) {
      this.lastStats=this.frames;
      this.port.postMessage({type:'stats',phase:this.phase,epoch:this.epoch,semitones:this.currentPitch,
        elapsedSeconds:this.frames/sampleRate,queueFrames:this.queued,queueMs:1000*this.queued/sampleRate,
        queueCapacityFrames:this.capacity,pendingInputFrames:this.inFlight,inputLimitFrames:this.inputLimitFrames,
        capturedFrames:this.inputFrames,generatedFrames:this.generatedFrames,playedFrames:this.playedFrames,
        underruns:this.underruns,overruns:this.overruns,overloads:this.overloads,
        droppedInputFrames:this.droppedInputFrames,discardedOutputFrames:this.discardedOutputFrames,
        inputRms:this.inputRms,outputRms:this.outputRms,processingMs:this.processingMs,
        inputPreview:this.previewIn,outputPreview:this.previewOut});
    }
    return true;
  }
}
registerProcessor('live-pitch-io',LivePitchIO);
