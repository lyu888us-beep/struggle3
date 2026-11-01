import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {Therapies} from './customer-content';

// Rebuilt public chapter: the educational figure is original and does not use
// the former site's acupuncture atlas or image URL.
export function PublicTcm(){
 return <div className="public-tcm">
  <header className="public-tcm-nav"><a href="/" className="public-tcm-brand"><span>✚</span> 蓉渝康养行</a><nav><a href="/medical">陪诊就医</a><a href="/recovery">康养之路</a><a href="/travel">旅行疗愈</a></nav><div><Link className="public-tcm-sign" to="/login">登录</Link><Link className="btn btn-small" to="/register">免费注册</Link></div></header>
  <div className="public-tcm-inner">
   <a href="/" className="public-tcm-back"><ArrowLeft size={15}/>返回首页</a>
   <div className="public-tcm-hero"><div><span>TRADITIONAL CHINESE MEDICINE</span><h1>中医国粹<br/><em>认识传统，谨慎体验。</em></h1><p>了解中医常见项目与人体穴位的基础知识。任何诊断和治疗，请咨询有资质的医护人员。</p><a className="btn" href="#acupoints">认识常用穴位 <ArrowRight size={16}/></a></div><div className="public-tcm-seal" aria-hidden="true">本<span>草</span>经络<br/>养生</div></div>
   <Therapies/>
   <footer className="public-tcm-footer"><span>蓉渝康养行</span><a href="/">返回首页</a><Link to="/login">登录顾客端</Link></footer>
  </div>
 </div>
}
