import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import * as Stomp from '@stomp/stompjs';
import SockJS from 'sockjs-client'
import {Message} from '../../models/message';

@Component({
  selector: 'app-chat',
  imports: [FormsModule, CommonModule],
  templateUrl: './chat.html',
})
export class Chat implements OnInit {

  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  client!: Stomp.Client
  connected: boolean = false;
  messages: Message[] = [];
  message: Message = new Message();
  writing!: string;
  clientId!: string;

  constructor() {
    this.clientId = 'id-' + new Date().getTime() + '-' + Math.random().toString(36).substring(2);
  }

  ngOnInit(): void {

    this.client = new Stomp.Client({
      brokerURL: undefined,
      webSocketFactory: () => new SockJS('http://localhost:8080/chat-websocket'),
      debug: str => console.log(str),
      reconnectDelay: 5000
    });

    this.client.onConnect = (frame) => {

      this.connected = true;
      console.log(`Conectados: ${this.client.connected} : ${frame}`)

      this.client.subscribe('/chat/message', e => {
        console.log(e.body)
        let message: Message = JSON.parse(e.body) as Message;
        message.date = new Date(message.date)
        if (this.message.username == message.username && !this.message.color && message.type == 'NEW_USER') {
          this.message.color = message.color
        }
        this.messages.push(message);

        setTimeout(() => this.scrollToBottom(), 100);
      });

      this.client.subscribe('/chat/writing', event => {
        this.writing = event.body;
        setTimeout(() => this.writing = '', 3000)
      });

      console.log('clientId' + this.clientId);
      this.client.subscribe(`/chat/history/${this.clientId}`, event => {
        const histories = JSON.parse(event.body) as Message[];
        this.messages = histories;

        setTimeout(() => this.scrollToBottom(), 100);
      });

      this.client.publish({destination: '/app/history', body: this.clientId})

      this.message.type = 'NEW_USER';
      this.client.publish({
        destination: '/app/message',
        body: JSON.stringify(this.message)

      })

    }

    this.client.onDisconnect = (frame) => {
      this.connected = false;
      this.message = new Message();
      this.messages = [];
      console.log(`Desconectados: ${!this.client.connected}: ${frame}`)
    }

  }

  connect(): void {
    this.client.activate();
  }

  disconnect(): void {
    this.client.deactivate();
  }


  onSendMessage() {

    //Validar que el mensaje no este vació o solo tenga espacios
    if (!this.message.text || this.message.text.trim() === '') {
      return; //No enviar mensaje
    }

    this.message.type = 'MESSAGE';
    this.client.publish({
      destination: '/app/message',
      body: JSON.stringify(this.message)
    });

    this.message.text = '';

    //Mantener el foco en el input después de enviar
    setTimeout(() => {
      this.messageInput?.nativeElement.focus();
    }, 0)
  }

  onWritingEvent(): void {
    this.client.publish({
      destination: '/app/writing',
      body: this.message.username
    })
  }

  private scrollToBottom(): void {
    try {

      if (this.chatMessagesContainer) {
        this.chatMessagesContainer.nativeElement.scrollTop = this.chatMessagesContainer.nativeElement.scrollHeight;
      }

    } catch (e) {
      console.error('Error al hacer scroll:', e);
    }
  }

}
