import React from 'react';
import { Lbryio } from 'lbryinc';
import { ActivityIndicator, NativeModules, ScrollView, Text, View } from 'react-native';
import Colors from 'styles/colors';
import Constants from 'constants'; // eslint-disable-line node/no-deprecated-api
import Link from 'component/link';
import CustomRewardCard from 'component/customRewardCard';
import EmptyStateView from 'component/emptyStateView';
import RewardCard from 'component/rewardCard';
import RewardEnrolment from 'component/rewardEnrolment';
import UriBar from 'component/uriBar';
import rewardStyle from 'styles/reward';

const FILTER_ALL = 'all';
const FILTER_AVAILABLE = 'available';
const FILTER_CLAIMED = 'claimed';

class RewardsPage extends React.PureComponent {
  state = {
    currentFilter: FILTER_AVAILABLE,
    firstRewardClaimed: false,
    isEmailVerified: false,
    isIdentityVerified: false,
    isRewardApproved: false,
    revealVerification: true,
    usdExchangeRate: 0,
    verifyRequestStarted: false,
  };

  scrollView = null;

  didFocusListener;

  componentWillMount() {
    const { navigation } = this.props;
    // this.didFocusListener = navigation.addListener('didFocus', this.onComponentFocused);
  }

  componentWillUnmount() {
    if (this.didFocusListener) {
      this.didFocusListener.remove();
    }
  }

  onComponentFocused = () => {
    const { fetchRewards, pushDrawerStack, navigation, setPlayerVisible, user } = this.props;

    pushDrawerStack();
    setPlayerVisible();
    NativeModules.Firebase.setCurrentScreen('Rewards');

    Lbryio.getExchangeRates().then(rates => {
      if (!isNaN(rates.LBC_USD)) {
        this.setState({ usdExchangeRate: rates.LBC_USD });
      }
    });

    fetchRewards();

    this.setState({
      isEmailVerified: user && user.primary_email && user.has_verified_email,
      isIdentityVerified: user && user.is_identity_verified,
      isRewardApproved: user && user.is_reward_approved,
    });
  };

  componentDidMount() {
    this.onComponentFocused();
  }

  componentWillReceiveProps(nextProps) {
    const { currentRoute, emailVerifyErrorMessage, emailVerifyPending, rewards, user } = nextProps;
    const { claimReward, currentRoute: prevRoute } = this.props;

    if (Constants.DRAWER_ROUTE_REWARDS === currentRoute && currentRoute !== prevRoute) {
      this.onComponentFocused();
    }

    if (emailVerifyPending) {
      this.setState({ verifyRequestStarted: true });
    }

    if (this.state.verifyRequestStarted && !emailVerifyPending) {
      this.setState({ verifyRequestStarted: false });
      if (!emailVerifyErrorMessage) {
        this.setState({ isEmailVerified: true });
      }
    }

    if (user) {
      // update other checks (if new user data has been retrieved)
      this.setState({
        isEmailVerified: user && user.primary_email && user.has_verified_email,
        isIdentityVerified: user && user.is_identity_verified,
        isRewardApproved: user && user.is_reward_approved,
      });
    }

    if (rewards && rewards.length && this.state.isRewardApproved && !this.state.firstRewardClaimed) {
      // claim new_user and new_mobile rewards
      for (let i = 0; i < rewards.length; i++) {
        const { reward_type: type } = rewards[i];
        if (type === 'new_user' || type === 'new_mobile') {
          claimReward(rewards[i]);
        }
      }
      this.setState({ firstRewardClaimed: true });
    }
  }

  renderVerification() {
    if (this.state.isRewardApproved) {
      return null;
    }

    if (this.state.isEmailVerified && this.state.isIdentityVerified && !this.state.isRewardApproved) {
      return (
        <View style={[rewardStyle.card, rewardStyle.verification]}>
          <Text style={rewardStyle.title}>{__('Manual Reward Verification')}</Text>
          <Text style={rewardStyle.text}>
            __('You need to be manually verified before you can start claiming rewards.') Please request to be verified
            on the{' '}
            <Link
              style={rewardStyle.greenLink}
              href="https://discordapp.com/invite/Z3bERWA"
              text="LBRY Discord server"
            />
            .
          </Text>
        </View>
      );
    }

    return null;
  }

  renderUnclaimedRewards() {
    const { claimed, fetching, rewards, user } = this.props;
    const unclaimedRewards = rewards && rewards.length ? rewards : [];

    if (fetching) {
      return (
        <View style={rewardStyle.busyContainer}>
          <ActivityIndicator size="large" color={Colors.NextLbryGreen} />
          <Text style={rewardStyle.infoText}>{__('Fetching rewards...')}</Text>
        </View>
      );
    } else if (user === null) {
      return (
        <View style={rewardStyle.busyContainer}>
          <Text style={rewardStyle.infoText}>
            {__('This app is unable to earn rewards due to an authentication failure.')}
          </Text>
        </View>
      );
    }

    const isNotEligible = !user || !user.primary_email || !user.has_verified_email || !user.is_reward_approved;
    return (
      <View>
        {unclaimedRewards.map(reward => (
          <RewardCard
            key={reward.reward_type}
            showVerification={this.showVerification}
            canClaim={!isNotEligible}
            reward={reward}
            reward_type={reward.reward_type}
            usdExchangeRate={this.state.usdExchangeRate}
          />
        ))}
        <CustomRewardCard canClaim={!isNotEligible} showVerification={this.showVerification} />
      </View>
    );
  }

  renderClaimedRewards() {
    const { claimed } = this.props;
    if (claimed && claimed.length) {
      const reversed = claimed.reverse();
      return (
        <View>
          {reversed.map(reward => (
            <RewardCard key={reward.transaction_id} reward={reward} />
          ))}
        </View>
      );
    }
  }

  showVerification = () => {
    this.setState({ revealVerification: true }, () => {
      if (this.scrollView) {
        this.scrollView.scrollTo({ x: 0, y: 0, animated: true });
      }
    });
  };

  setFilter = filter => {
    this.setState({ currentFilter: filter });
  };

  render() {
    const { navigation, sdkReady } = this.props;
    const { currentFilter } = this.state;

    if (!sdkReady) {
      return (
        <View style={rewardStyle.container}>
          <UriBar navigation={navigation} />
          <EmptyStateView
            message={__(
              'The background service is still initializing. You can still explore and watch content during the initialization process.',
            )}
          />
        </View>
      );
    }

    return (
      <View style={rewardStyle.container}>
        <UriBar navigation={navigation} />
        {(!this.state.isEmailVerified || !this.state.isRewardApproved) && (
          <RewardEnrolment usdExchangeRate={this.state.usdExchangeRate} navigation={navigation} />
        )}

        {this.state.isEmailVerified && this.state.isRewardApproved && (
          <ScrollView
            ref={ref => (this.scrollView = ref)}
            keyboardShouldPersistTaps={'handled'}
            style={rewardStyle.scrollContainer}
            contentContainerStyle={rewardStyle.scrollContentContainer}
          >
            <View style={rewardStyle.filterHeader}>
              <Link
                style={[rewardStyle.filterLink, currentFilter === FILTER_ALL ? rewardStyle.activeFilterLink : null]}
                text={__('All')}
                onPress={() => this.setFilter(FILTER_ALL)}
              />
              <Link
                style={[
                  rewardStyle.filterLink,
                  currentFilter === FILTER_AVAILABLE ? rewardStyle.activeFilterLink : null,
                ]}
                text={__('Available')}
                onPress={() => this.setFilter(FILTER_AVAILABLE)}
              />
              <Link
                style={[rewardStyle.filterLink, currentFilter === FILTER_CLAIMED ? rewardStyle.activeFilterLink : null]}
                text={__('Claimed')}
                onPress={() => this.setFilter(FILTER_CLAIMED)}
              />
            </View>

            {(currentFilter === FILTER_AVAILABLE || currentFilter === FILTER_ALL) && this.renderUnclaimedRewards()}
            {(currentFilter === FILTER_CLAIMED || currentFilter === FILTER_ALL) && this.renderClaimedRewards()}
          </ScrollView>
        )}
      </View>
    );
  }
}

export default RewardsPage;
