import React, { Component } from 'react';
import { View, TouchableOpacity, Text, FlatList, Alert, StyleSheet } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';
import { StreamChat } from 'stream-chat';
import Config from 'react-native-config';
import axios from 'axios';
import Modal from 'react-native-modal';

const CHAT_SERVER = 'YOUR NGROK HTTPS URL';

const client = new StreamChat(Config.APP_KEY);

class Chat extends Component {

  state = {
    is_ready: false,
    messages: [],
    is_users_modal_visible: false
  }


  static navigationOptions = ({ navigation }) => {
    const { params } = navigation.state;
    return {
      headerTitle: 'sample-room1',

      headerRight: (
        <View style={styles.header_right}>
          <TouchableOpacity style={styles.header_button_container} onPress={params.showUsersModal}>
            <View>
              <Text style={styles.header_button_text}>Users</Text>
            </View>
          </TouchableOpacity>
        </View>

      ),

      headerStyle: {
        backgroundColor: "#333"
      },
      headerTitleStyle: {
        color: "#FFF"
      }
    }
  }
  //

  constructor(props) {
    super(props);
    const { navigation } = this.props;
    this.user_id = navigation.getParam('user_id');
    this.username = navigation.getParam('username');
    this.user_token = navigation.getParam('user_token');
  }


  componentWillUnMount() {
    client.disconnect();
  }


  async componentDidMount() {

    this.props.navigation.setParams({
      showUsersModal: this.showUsersModal
    });

    try {
      const user = await client.setUser(
        {
          id: this.user_id,
          name: this.username,
          image: `https://ui-avatars.com/api/?background=d88413&color=FFF&name=${this.username}`,
        },
        this.user_token
      );

      await axios.post(`${CHAT_SERVER}/add-member`, {
        user_id: this.user_id
      });

      const channel = client.channel('messaging', 'sample-room1');
      this.channel = channel;

      const channel_state = await channel.watch({ presence: true });
      this.channel_state = channel_state;

      this.setState({
        is_ready: true
      });

      await this.asyncForEach(channel_state.messages, async (msg) => {
        const { message } = this.getMessage(msg);
        await this.setState((previousState) => ({
          messages: GiftedChat.append(previousState.messages, message)
        }));
      });

      channel.on('message.new', async (event) => {
        const { message } = this.getMessage(event.message);
        await this.setState((previousState) => ({
          messages: GiftedChat.append(previousState.messages, message)
        }));
      });

      channel.on('message.updated', async (event) => {
        const { message } = this.getMessage(event.message);
        if (message.user._id == this.user_id) {
          if (message.user.warn_count < 3) {
            Alert.alert("Profanity warning", "You will be banned indefinitely on the 3rd time you do this.");
          }
        }

        this.setState(state => {
          const messages = state.messages.map((item) => {
            if (item._id == message._id) {
              return { ...item, text: message.text };
            } else {
              return item;
            }
          });

          return {
            messages
          }
        });

      });

    } catch (err) {
      console.log("error: ", err);
    }
  }


  asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }


  getMessage = ({ id, user, text, created_at }) => {
    const data = {
      _id: id,
      text: text,
      createdAt: new Date(created_at),
      user: {
        _id: user.id,
        name: user.name,
        avatar: user.image,
        warn_count: user.warn_count
      }
    }

    return {
      message: data
    }
  }


  render() {
    const { messages, is_users_modal_visible, is_ready } = this.state;
    if (is_ready) {
      const channel_users = this.channel_state.members;
      return (
        <View style={styles.container}>
          <GiftedChat
            messages={messages}
            onSend={messages => this.onSend(messages)}
            user={{
              _id: this.user_id
            }}
          />
          <Modal isVisible={is_users_modal_visible}>
            <View style={styles.modal}>
              <View style={styles.modal_header}>
                <Text style={styles.modal_header_text}>Users</Text>
                <TouchableOpacity onPress={this.hideModal.bind(this, 'users')}>
                  <View>
                    <Text>Close</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.modal_body}>
                <FlatList
                  keyExtractor={item => item.user.id.toString()}
                  data={channel_users}
                  renderItem={this.renderUser}
                />
              </View>
            </View>
          </Modal>
        </View>
      );
    }

    return null;
  }
  //


  renderUser = ({ item }) => {
    const online_status = (item.user.online) ? 'online' : 'offline';

    return (
      <View style={styles.list_item_body}>
        <View style={styles.list_item}>
          <View style={styles.inline_contents}>
            <View style={[styles.status_indicator, styles[online_status]]}></View>
            <Text style={styles.list_item_text}>{item.user.name}</Text>
            {
              item.user.warn_count > 2 &&
              <View style={styles.banned}>
                <Text style={styles.banned_text}>Banned</Text>
              </View>
            }
          </View>
        </View>
      </View>
    );
  }
  //


  onSend = async ([message]) => {
    const message_response = await this.channel.sendMessage({
      text: message.text
    });
    if (message_response.message.type == 'error') {
      Alert.alert("Error", message_response.message.text);
    }
  }


  hideModal = (type) => {
    this.setState({
      is_users_modal_visible: false
    });
  }


  showUsersModal = () => {
    this.setState({
      is_users_modal_visible: true
    });
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  header_right: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around"
  },
  header_button_container: {
    marginRight: 10
  },
  header_button_text: {
    color: '#FFF'
  },

  modal: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  close: {
    alignSelf: 'flex-end',
    marginBottom: 10
  },
  modal_header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10
  },
  modal_header_text: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  modal_body: {
    marginTop: 20,
    padding: 20
  },

  list_item_body: {
    flex: 1,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  list_item: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  list_item_text: {
    marginLeft: 10,
    fontSize: 20,
  },
  inline_contents: {
    flex: 1,
    flexDirection: 'row'
  },
  status_indicator: {
    width: 10,
    height: 10,
    alignSelf: 'center',
    borderRadius: 10,
  },
  online: {
    backgroundColor: '#5bb90b'
  },
  offline: {
    backgroundColor: '#606060'
  },

  banned: {
    marginLeft: 10,
    backgroundColor: '#cc0000',
    padding: 3
  },
  banned_text: {
    color: '#FFF',
    fontSize: 12
  }
});

export default Chat;